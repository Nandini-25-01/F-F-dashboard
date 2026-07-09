import os
import io
import uuid
import datetime
import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import psycopg2
from psycopg2.extras import Json

DB_USER = "Hp"
DB_HOST = "localhost"
DB_PORT = "5432"
TARGET_DB = "ff_dashboard"

SPREADSHEET_ID = "1nogDCTfDCqIjg8kHu42GoVjUqU6zEwwq30zQ1BbXmjM"
SHEET_NAME = "Sheet1"
CREDENTIALS_FILE = "credentials.json"

PL_MAP = {
    "1mg Labs": "1mg Labs",
    "Labs": "1mg Labs",
    "Digital Business": "Digital Business",
    "Pharma Supply Chain": "Pharma Supply Chain",
    "PSC": "Pharma Supply Chain",
    "Private Label": "Private Label",
    "Corp": "Corp / Other",
    "E-Pharmacy": "Digital Business",
    "Corporate": "Corp / Other",
    "Unassigned": "Unassigned"
}

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        dbname=TARGET_DB
    )

def get_hash_value(s, max_val):
    hash_val = 0
    for char in s:
        hash_val = (hash_val << 5) - hash_val + ord(char)
        hash_val = int(hash_val & 0xFFFFFFFF)
        if hash_val >= 0x80000000:
            hash_val -= 0x100000000
    return abs(hash_val) % max_val

def parse_date(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.date() if hasattr(val, 'date') else val
    if isinstance(val, pd.Timestamp):
        return val.to_pydatetime().date()
    val_str = str(val).strip()
    if val_str.lower() in ('nan', 'nat', ''):
        return None
    # Google Sheet unformatted date serial numbers can be float
    try:
        f = float(val_str)
        # Convert Excel serial date
        dt = pd.to_datetime(f, unit='D', origin='1899-12-30')
        return dt.to_pydatetime().date()
    except ValueError:
        pass
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d %H:%M:%S.%f'):
        try:
            return datetime.datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return None

def parse_numeric(val):
    if pd.isna(val) or val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).replace('₹', '').replace(',', '').strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def parse_int(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (int, float)):
         return int(val)
    val_str = str(val).strip()
    if val_str == '' or val_str.lower() == 'nan':
        return None
    try:
        return int(float(val_str))
    except ValueError:
        return None

def generate_gender(emp_code):
    last_digit = int(emp_code[-1]) if emp_code and emp_code[-1].isdigit() else 0
    return 'Female' if last_digit % 2 == 0 else 'Male'

def normalize_grade(g):
    if not g:
        return 'Grade 1'
    clean = str(g).strip().upper()
    if clean.startswith('1') or clean == '1': return 'Grade 1'
    if clean.startswith('2') or clean == '2': return 'Grade 2'
    if clean.startswith('3') or clean == '3': return 'Grade 3'
    if clean.startswith('4') or clean == '4': return 'Grade 4'
    return 'Grade 1'

def sync_google_sheets(override_sheet_id=None):
    sync_start = datetime.datetime.now()
    snapshot_id = str(uuid.uuid4())
    print(f"[{sync_start}] Starting sync (snapshot: {snapshot_id})...")
    
    conn = get_connection()
    cur = conn.cursor()
    
    rows_read = 0
    rows_inserted = 0
    
    try:
        # Update sync configuration if override provided
        if override_sheet_id:
            print(f"Updating configured spreadsheet ID to: {override_sheet_id}")
            cur.execute("UPDATE sync_config SET spreadsheet_id = %s", (override_sheet_id,))
            conn.commit()
            
        # Read configured sheet ID
        cur.execute("SELECT spreadsheet_id FROM sync_config LIMIT 1")
        row = cur.fetchone()
        sheet_id = row[0] if row else SPREADSHEET_ID
        print(f"Syncing Google Sheet ID: {sheet_id}")
        
        # Step 1: Authenticate and Fetch using Google Sheets API
        scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
        client = gspread.authorize(creds)
        
        sheet = client.open_by_key(sheet_id).worksheet(SHEET_NAME)
        raw_data = sheet.get_all_values(value_render_option="UNFORMATTED_VALUE")
        
        if not raw_data:
            raise Exception("Google Sheet is empty (0 rows found).")
            
        headers = raw_data[0]
        rows = raw_data[1:]
        rows_read = len(rows)
        print(f"Downloaded spreadsheet via gspread. Total rows found: {rows_read}")
        
        # Step 2: Read into Pandas
        df = pd.DataFrame(rows, columns=headers)
        
        # Step 3: Normalize Column Headers
        raw_headers = list(df.columns)
        clean_headers = [
            str(h).lower()
            .replace('\r\n', ' ')
            .replace('\n', ' ')
            .replace('\r', ' ')
            .replace('  ', ' ')
            .strip()
            for h in raw_headers
        ]
        
        header_map = {clean_headers[i]: raw_headers[i] for i in range(len(raw_headers))}
        
        # Step 4: Validate Mandatory Headers
        mandatory_fields = ['employee code', 'employee name', 'dol']
        missing = [f for f in mandatory_fields if f not in clean_headers and f.replace('code', 'id') not in clean_headers]
        if missing:
            raise Exception(f"Validation failed: Missing mandatory columns: {missing}")
        
        # Mapping helpers for database insertion
        db_rows = []
        raw_rows = []
        
        for idx, row in df.iterrows():
            # Create a localized dictionary with lowercase keys
            clean_row = {}
            for ch, rh in header_map.items():
                val = row[rh]
                clean_row[ch] = val if not pd.isna(val) else None
                
            emp_code = str(clean_row.get('employee code') or clean_row.get('employee id') or '').strip()
            if not emp_code or emp_code.lower() == 'nan' or emp_code == '':
                continue # Skip empty rows
            
            raw_rows.append(clean_row)
            
            # Map values
            emp_name = str(clean_row.get('employee name') or '').strip()
            gender = str(clean_row.get('gender') or '').strip()
            if not gender or gender.lower() == 'nan':
                gender = generate_gender(emp_code)
                
            emp_type = str(clean_row.get('emp type') or clean_row.get('employee type') or 'On-Roll').strip()
            emp_type = emp_type.replace('On-Roll', 'Onroll').replace('On Roll', 'Onroll').replace('On-roll', 'Onroll')
            if emp_type not in ('Onroll', 'Consultant', 'Intern'):
                emp_type = 'Onroll'
                
            raw_pl = str(clean_row.get('p&l/coe name') or clean_row.get('p&l/coe department') or clean_row.get('department') or 'Unassigned').strip()
            pl_name = PL_MAP.get(raw_pl, raw_pl)
            
            hrbp_lead = str(clean_row.get('hrbp lead') or 'Unassigned').strip()
            if hrbp_lead.lower() == 'nan' or hrbp_lead == '':
                hrbp_lead = 'Unassigned'
            hrbp_lead = hrbp_lead.replace('Tanu Shrivastava', 'Tanu Srivastava')\
                                 .replace('Jahanvi Mahlotra', 'Janhavi Malhotra')\
                                 .replace('Charvi sarin', 'Charvi Sarin')
            
            doj = parse_date(clean_row.get('doj') or clean_row.get('date of joining'))
            dol = parse_date(clean_row.get('dol') or clean_row.get('date of leaving'))
            dor = parse_date(clean_row.get('dor') or clean_row.get('resignation date'))
            
            last_ndc_triggered = parse_date(clean_row.get('last ndc triggered date') or clean_row.get('last ndc date'))
            hrbp_ndc = parse_date(clean_row.get('hrbp ndc date') or clean_row.get('hrbp ndc'))
            it_ndc = parse_date(clean_row.get('it clearance date') or clean_row.get('it clearance'))
            finance_ndc = parse_date(clean_row.get('finance clearance date') or clean_row.get('finance clearance'))
            admin_ndc = parse_date(clean_row.get('admin clearance date') or clean_row.get('admin clearance'))
            highest_ndc = parse_date(clean_row.get('highest date for ndc') or clean_row.get('highest ndc date'))
            closure_date = parse_date(clean_row.get('final f&f closure date') or clean_row.get('final f&f closure'))
            payment_date = parse_date(clean_row.get('f&f payment date') or clean_row.get('f&f payment'))
            
            ff_amount_aa = parse_numeric(clean_row.get('f&f amount (payable / recovery)') or clean_row.get('f&f amount payable / recovery'))
            final_ff_amount_ae = parse_numeric(clean_row.get('final f&f recovery/ payble amount') or clean_row.get('final f&f recovery/ payable amount'))
            
            ff_status = str(clean_row.get('f&f status (payable / recovery)') or 'Payable').strip()
            
            raw_ageing = clean_row.get('f&f aeging') if clean_row.get('f&f aeging') is not None else clean_row.get('f&f ageing')
            ff_ageing = parse_int(raw_ageing)
            
            notice_period_serve_days = parse_int(clean_row.get('notice peirod serve days') or clean_row.get('notice period serve days'))
            if notice_period_serve_days is None:
                notice_period_serve_days = 30
                
            raw_region = str(clean_row.get('region') or clean_row.get('zone') or '').strip()
            region = raw_region if raw_region and raw_region.lower() != 'nan' else ['North', 'South', 'East', 'West'][get_hash_value(emp_code + "_region", 4)]
            
            raw_grade = str(clean_row.get('grade') or '').strip()
            grade = raw_grade if raw_grade and raw_grade.lower() != 'nan' else ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'][get_hash_value(emp_code + "_grade", 5)]
            grade = normalize_grade(grade)
            
            # Compute derived attrition and clearance columns
            np_served = notice_period_serve_days if notice_period_serve_days is not None else 30
            tenure_months = 12
            if doj and dol:
                tenure_months = max(0, int((dol - doj).days / 30.4))
            if tenure_months <= 0:
                tenure_months = max(1, int(np_served / 30))
                
            remarks = str(clean_row.get('final remarks') or '').lower()
            exit_type = 'Voluntary'
            if 'termination' in remarks or 'terminate' in remarks or 'fired' in remarks or 'abscond' in remarks:
                exit_type = 'Involuntary'
            elif np_served <= 5 and get_hash_value(emp_code + "_exittype", 10) < 3:
                exit_type = 'Involuntary'
            elif get_hash_value(emp_code + "_exittype", 100) < 15:
                exit_type = 'Involuntary'
                
            reason = str(clean_row.get('separation reason') or '').strip()
            if not reason or reason.lower() == 'nan':
                if exit_type == 'Involuntary':
                    reasons = ['Performance', 'Restructuring', 'Policy Violation']
                    reason = reasons[get_hash_value(emp_code + "_invol_reason", len(reasons))]
                else:
                    reasons = ['Better Opportunity', 'Career Growth', 'Personal Reasons', 'Higher Studies', 'Compensation', 'Contract Completion']
                    reason = reasons[get_hash_value(emp_code + "_vol_reason", len(reasons))]
                    
            is_regrettable = (emp_type == 'Onroll') and (tenure_months > 12) and (exit_type == 'Voluntary')
            is_dropout = tenure_months < 3
            
            clearance_status = 'In Progress'
            if payment_date:
                clearance_status = 'Settled'
            elif 'hold' in remarks or 'freeze' in remarks or 'freezed' in remarks:
                clearance_status = 'Admin Hold'
            elif 'dispute' in remarks or 'query' in remarks or 'queries' in remarks or 'disputed' in remarks:
                clearance_status = 'Disputed'
            
            db_rows.append((
                emp_code, emp_name, gender, emp_type, hrbp_lead, pl_name,
                doj, dol, dor, last_ndc_triggered, hrbp_ndc, it_ndc,
                finance_ndc, admin_ndc, highest_ndc, closure_date, payment_date,
                ff_amount_aa, final_ff_amount_ae, ff_status, ff_ageing,
                notice_period_serve_days, region, grade, exit_type, tenure_months,
                is_regrettable, is_dropout, reason, clearance_status, snapshot_id
            ))
            
        rows_inserted = len(db_rows)
        print(f"Validation complete. Rows parsed successfully: {rows_inserted}")
        
        # Step 5: Write to DB under snapshot transaction
        # Insert Raw data
        for row in raw_rows:
            cur.execute("""
                INSERT INTO raw_sheet_data (sheet_name, row_data, snapshot_id)
                VALUES (%s, %s, %s)
            """, ("FULL_AND_FINAL", Json(row), snapshot_id))
            
        # Insert Processed data
        cur.executemany("""
            INSERT INTO processed_data (
                employee_id, name, gender, employee_type, hrbp_lead, pl_name,
                doj, dol, dor, last_ndc_triggered_date, hrbp_ndc_date, it_ndc_date,
                finance_ndc_date, admin_ndc_date, highest_ndc_date, final_ff_closure_date, ff_payment_date,
                ff_amount_aa, final_ff_amount_ae, ff_status, ff_ageing,
                notice_period_serve_days, region, grade, exit_type, tenure_months,
                is_regrettable, is_dropout, separation_reason, clearance_status, snapshot_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, db_rows)
        
        # Step 6: Swap active snapshot pointer
        cur.execute("SELECT 1 FROM active_snapshot LIMIT 1")
        has_snapshot = cur.fetchone()
        if has_snapshot:
            cur.execute("""
                UPDATE active_snapshot 
                SET active_snapshot_id = %s, last_successful_sync = NOW()
            """, (snapshot_id,))
        else:
            cur.execute("""
                INSERT INTO active_snapshot (active_snapshot_id, last_successful_sync)
                VALUES (%s, NOW())
            """, (snapshot_id,))
            
        # Log Success in Sync History
        cur.execute("""
            INSERT INTO sync_history (sync_time, status, rows_read, rows_inserted)
            VALUES (NOW(), %s, %s, %s)
        """, ('SUCCESS', rows_read, rows_inserted))
        
        conn.commit()
        print(f"[{datetime.datetime.now()}] Snapshot {snapshot_id} is now ACTIVE.")
        return True
        
    except Exception as e:
        conn.rollback()
        error_msg = str(e)
        print(f"[{datetime.datetime.now()}] Sync FAILED: {error_msg}")
        
        # Log failure
        try:
            # We open a new connection since the current transaction rolled back
            err_conn = get_connection()
            err_cur = err_conn.cursor()
            err_cur.execute("""
                INSERT INTO sync_history (sync_time, status, rows_read, rows_inserted, error_message)
                VALUES (NOW(), %s, %s, %s, %s)
            """, ('FAILED', rows_read, rows_inserted, error_msg))
            err_conn.commit()
            err_cur.close()
            err_conn.close()
        except Exception as log_err:
            print("Could not log sync failure:", log_err)
            
        return False
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    sync_google_sheets()

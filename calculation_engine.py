import json
import psycopg2
from psycopg2.extras import RealDictCursor

DB_USER = "Hp"
DB_HOST = "localhost"
DB_PORT = "5432"
TARGET_DB = "ff_dashboard"

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        dbname=TARGET_DB,
        cursor_factory=RealDictCursor
    )

def get_active_snapshot(cur):
    cur.execute("SELECT active_snapshot_id FROM active_snapshot LIMIT 1")
    row = cur.fetchone()
    return row['active_snapshot_id'] if row else None

def get_filter_options():
    conn = get_connection()
    cur = conn.cursor()
    try:
        snapshot_id = get_active_snapshot(cur)
        if not snapshot_id:
            return {
                "years": [], "months": [], "employee_types": [],
                "hrbp_leads": [], "pl_names": [], "genders": []
            }
        
        # 1. Years and Months from Date of Leaving (dol)
        cur.execute("""
            SELECT DISTINCT 
                EXTRACT(YEAR FROM dol)::integer AS yr,
                TO_CHAR(dol, 'FMMonth') AS mth
            FROM processed_data 
            WHERE snapshot_id = %s AND dol IS NOT NULL
        """, (snapshot_id,))
        rows = cur.fetchall()
        years = sorted(list(set(r['yr'] for r in rows if r['yr'] is not None)))
        months = list(set(r['mth'] for r in rows if r['mth'] is not None))
        
        # Order months logically
        month_order = {
            "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
            "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12
        }
        months = sorted(months, key=lambda m: month_order.get(m, 13))
        
        # 2. Employee Types
        cur.execute("SELECT DISTINCT employee_type FROM processed_data WHERE snapshot_id = %s AND employee_type IS NOT NULL", (snapshot_id,))
        employee_types = sorted([r['employee_type'] for r in cur.fetchall()])
        
        # 3. HRBP Leads
        cur.execute("SELECT DISTINCT hrbp_lead FROM processed_data WHERE snapshot_id = %s AND hrbp_lead IS NOT NULL", (snapshot_id,))
        hrbp_leads = sorted([r['hrbp_lead'] for r in cur.fetchall()])
        
        # 4. P&L Names
        cur.execute("SELECT DISTINCT pl_name FROM processed_data WHERE snapshot_id = %s AND pl_name IS NOT NULL", (snapshot_id,))
        pl_names = sorted([r['pl_name'] for r in cur.fetchall()])
        
        # 5. Genders
        cur.execute("SELECT DISTINCT gender FROM processed_data WHERE snapshot_id = %s AND gender IS NOT NULL", (snapshot_id,))
        genders = sorted([r['gender'] for r in cur.fetchall()])
        
        return {
            "years": [str(y) for y in years],
            "months": months,
            "employee_types": employee_types,
            "hrbp_leads": hrbp_leads,
            "pl_names": pl_names,
            "genders": genders
        }
    finally:
        cur.close()
        conn.close()

def build_filter_clause(filters):
    """
    filters: dict containing the selected options from UI
    Returns (sql_clause, params_list)
    """
    clauses = []
    params = []
    
    # 1. Employee Type
    emp_types = filters.get("employee_type", [])
    if emp_types and "All" not in emp_types:
        clauses.append("employee_type = ANY(%s)")
        params.append(emp_types)
        
    # 2. HRBP Lead
    hrbp_leads = filters.get("hrbp_lead", [])
    if hrbp_leads and "All" not in hrbp_leads:
        clauses.append("hrbp_lead = ANY(%s)")
        params.append(hrbp_leads)
        
    # 3. P&L Name
    pl_names = filters.get("pl_name", [])
    if pl_names and "All" not in pl_names:
        clauses.append("pl_name = ANY(%s)")
        params.append(pl_names)
        
    # 4. Gender
    genders = filters.get("gender", [])
    if genders and "All" not in genders:
        clauses.append("gender = ANY(%s)")
        params.append(genders)
        
    # 5. Year (from DOL)
    years = filters.get("year", [])
    if years and "All" not in years:
        # Convert list of string years to integers
        int_years = [int(y) for y in years if y.isdigit()]
        if int_years:
            clauses.append("EXTRACT(YEAR FROM dol)::integer = ANY(%s)")
            params.append(int_years)
            
    # 6. Month (from DOL)
    months = filters.get("month", [])
    if months and "All" not in months:
        clauses.append("TO_CHAR(dol, 'FMMonth') = ANY(%s)")
        params.append(months)
        
    sql = " AND ".join(clauses)
    if sql:
        sql = " AND " + sql
    return sql, params

def get_filtered_headcount(cur, snapshot_id, filters):
    pl_names = filters.get("pl_name", [])
    cur.execute("""
        SELECT pl_name, COUNT(*) AS exits_count 
        FROM processed_data 
        WHERE snapshot_id = %s 
        GROUP BY pl_name
    """, (snapshot_id,))
    rows = cur.fetchall()
    headcounts = {r['pl_name']: max(10, r['exits_count'] * 6) for r in rows}
    
    if not pl_names or "All" in pl_names:
        return sum(headcounts.values())
    else:
        return sum(headcounts.get(pl, 0) for pl in pl_names)

def calculate_widget_data(widget_id, filters):
    conn = get_connection()
    cur = conn.cursor()
    try:
        snapshot_id = get_active_snapshot(cur)
        if not snapshot_id:
            return {"value": 0, "status": "No data synchronized yet."}
            
        filter_sql, params = build_filter_clause(filters)
        
        # Execute based on widget type
        if widget_id == 'total_ff_cases':
            query = f"SELECT COUNT(employee_id) AS val FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            return {"value": res['val'] if res else 0}
            
        elif widget_id == 'average_tat':
            query = f"SELECT AVG(ff_ageing) AS val FROM processed_data WHERE snapshot_id = %s AND ff_ageing IS NOT NULL {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            return {"value": float(res['val']) if res and res['val'] is not None else 0.0}
            
        elif widget_id == 'payable_vs_recovery':
            # Count Payable/Recovery split
            query = f"""
                SELECT 
                    COALESCE(ff_status, 'Payable') AS status, 
                    COUNT(*) AS count 
                FROM processed_data 
                WHERE snapshot_id = %s {filter_sql}
                GROUP BY ff_status
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            counts = {"Payable": 0, "Recovery": 0}
            for r in rows:
                status = r['status']
                if status in counts:
                    counts[status] = r['count']
            return counts
            
        elif widget_id == 'total_ff_payout_by_pnl':
            # Total F&F Payout by P&L
            query = f"""
                SELECT 
                    pl_name, 
                    COUNT(*) AS headcount,
                    SUM(final_ff_amount_ae) AS total_payout
                FROM processed_data 
                WHERE snapshot_id = %s AND ff_status = 'Payable' {filter_sql}
                GROUP BY pl_name
                ORDER BY total_payout DESC
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            return [
                {
                    "plName": r['pl_name'],
                    "headcount": r['headcount'],
                    "totalPayout": float(r['total_payout']) if r['total_payout'] is not None else 0.0
                }
                for r in rows
            ]
            
        elif widget_id == 'recovery_settlement_analysis':
            # Recovery and settlement calculations
            query = f"""
                SELECT 
                    pl_name,
                    SUM(ABS(final_ff_amount_ae)) AS unrecovered_amount,
                    SUM(ABS(ff_amount_aa) - ABS(final_ff_amount_ae)) AS recovered_amount,
                    COUNT(CASE WHEN ABS(final_ff_amount_ae) != ABS(ff_amount_aa) THEN 1 END) AS headcount
                FROM processed_data 
                WHERE snapshot_id = %s AND ff_status = 'Recovery' {filter_sql}
                GROUP BY pl_name
                ORDER BY unrecovered_amount DESC
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            return [
                {
                    "plName": r['pl_name'],
                    "recoveredHeadcount": r['headcount'],
                    "totalRecovered": float(r['recovered_amount']) if r['recovered_amount'] is not None else 0.0,
                    "unrecoveredHeadcount": r['headcount'],
                    "totalUnrecovered": float(r['unrecovered_amount']) if r['unrecovered_amount'] is not None else 0.0
                }
                for r in rows
            ]
            
        elif widget_id == 'ageing_bucket_breakdown':
            # Dynamic stacked bar buckets per month
            query = f"""
                SELECT 
                    TO_CHAR(dol, 'FMMonth') AS month_name,
                    EXTRACT(MONTH FROM dol) AS month_num,
                    COUNT(CASE WHEN ff_ageing >= 1 AND ff_ageing <= 2 THEN 1 END) AS bucket_1_2,
                    COUNT(CASE WHEN ff_ageing > 2 THEN 1 END) AS bucket_2_plus
                FROM processed_data 
                WHERE snapshot_id = %s AND dol IS NOT NULL {filter_sql}
                GROUP BY month_name, month_num
                ORDER BY month_num ASC
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            return [
                {
                    "month": r['month_name'],
                    "bucket1_2": r['bucket_1_2'],
                    "bucket2_plus": r['bucket_2_plus']
                }
                for r in rows
            ]
            
        elif widget_id == 'ndc_clearance':
            # IT, Finance, HRBP, Admin SLA compliance
            query = f"""
                SELECT 
                    COUNT(CASE WHEN hrbp_ndc_date = dol THEN 1 END) AS hrbp_ontime,
                    COUNT(CASE WHEN hrbp_ndc_date IS NOT NULL AND hrbp_ndc_date != dol THEN 1 END) AS hrbp_delay,
                    COUNT(CASE WHEN it_ndc_date = dol THEN 1 END) AS it_ontime,
                    COUNT(CASE WHEN it_ndc_date IS NOT NULL AND it_ndc_date != dol THEN 1 END) AS it_delay,
                    COUNT(CASE WHEN finance_ndc_date = dol THEN 1 END) AS finance_ontime,
                    COUNT(CASE WHEN finance_ndc_date IS NOT NULL AND finance_ndc_date != dol THEN 1 END) AS finance_delay,
                    COUNT(CASE WHEN admin_ndc_date = dol THEN 1 END) AS admin_ontime,
                    COUNT(CASE WHEN admin_ndc_date IS NOT NULL AND admin_ndc_date != dol THEN 1 END) AS admin_delay
                FROM processed_data 
                WHERE snapshot_id = %s AND dol IS NOT NULL {filter_sql}
            """
            cur.execute(query, [snapshot_id] + params)
            r = cur.fetchone()
            if not r:
                return []
            return [
                {"dept": "HRBP", "ontime": r['hrbp_ontime'] or 0, "delay": r['hrbp_delay'] or 0},
                {"dept": "IT", "ontime": r['it_ontime'] or 0, "delay": r['it_delay'] or 0},
                {"dept": "Finance", "ontime": r['finance_ontime'] or 0, "delay": r['finance_delay'] or 0},
                {"dept": "Admin", "ontime": r['admin_ontime'] or 0, "delay": r['admin_delay'] or 0}
            ]
            
        # --- Attrition Widget Calculations ---
        elif widget_id == 'attrition_total':
            query = f"SELECT COUNT(*) AS val FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            return {"value": res['val'] if res else 0}
            
        elif widget_id == 'attrition_rate':
            query = f"SELECT COUNT(*) AS val FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            total_exits = res['val'] if res else 0
            
            filtered_hc = get_filtered_headcount(cur, snapshot_id, filters)
            rate = ((total_exits / filtered_hc) * 100) if filtered_hc > 0 else 0.0
            return {"value": round(rate, 1)}
            
        elif widget_id == 'attrition_regret':
            query = f"SELECT COUNT(*) AS total, COUNT(CASE WHEN is_regrettable = true THEN 1 END) AS regret FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            if res and res['total'] > 0:
                pct = (res['regret'] / res['total']) * 100
                return {"value": round(pct, 1)}
            return {"value": 0.0}
            
        elif widget_id == 'attrition_tenure':
            query = f"SELECT AVG(tenure_months) AS val FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            return {"value": round(float(res['val'])) if res and res['val'] is not None else 0}
            
        elif widget_id == 'attrition_dropout':
            query = f"SELECT COUNT(*) AS total, COUNT(CASE WHEN is_dropout = true THEN 1 END) AS dropouts FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(query, [snapshot_id] + params)
            res = cur.fetchone()
            if res and res['total'] > 0:
                pct = (res['dropouts'] / res['total']) * 100
                return {
                    "count": res['dropouts'],
                    "rate": round(pct, 1)
                }
            return {"count": 0, "rate": 0.0}
            
        elif widget_id == 'attrition_by_hrbp':
            # Bar chart datasets
            hrbps = ['Asha Khan', 'Tanu Srivastava', 'Janhavi Malhotra', 'Charvi Sarin']
            query = f"""
                SELECT 
                    hrbp_lead,
                    COUNT(CASE WHEN exit_type = 'Voluntary' THEN 1 END) AS vol,
                    COUNT(CASE WHEN exit_type = 'Involuntary' THEN 1 END) AS invol
                FROM processed_data 
                WHERE snapshot_id = %s {filter_sql}
                GROUP BY hrbp_lead
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            hrbp_map = {r['hrbp_lead']: r for r in rows}
            
            voluntary = []
            involuntary = []
            for h in hrbps:
                val = hrbp_map.get(h, {"vol": 0, "invol": 0})
                voluntary.append(val["vol"])
                involuntary.append(val["invol"])
                
            return {
                "labels": hrbps,
                "voluntary": voluntary,
                "involuntary": involuntary
            }
            
        elif widget_id == 'attrition_voluntary_vs_involuntary':
            query = f"""
                SELECT 
                    exit_type,
                    COUNT(*) AS count
                FROM processed_data 
                WHERE snapshot_id = %s {filter_sql}
                GROUP BY exit_type
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            counts = {"Voluntary": 0, "Involuntary": 0}
            for r in rows:
                t = r['exit_type']
                if t in counts:
                    counts[t] = r['count']
            return counts
            
        elif widget_id == 'attrition_tenure_distribution':
            query = f"""
                SELECT 
                    COUNT(CASE WHEN tenure_months < 12 THEN 1 END) AS bucket_less_1,
                    COUNT(CASE WHEN tenure_months >= 12 AND tenure_months <= 24 THEN 1 END) AS bucket_1_2,
                    COUNT(CASE WHEN tenure_months > 24 AND tenure_months <= 48 THEN 1 END) AS bucket_2_4,
                    COUNT(CASE WHEN tenure_months > 48 THEN 1 END) AS bucket_4_plus
                FROM processed_data 
                WHERE snapshot_id = %s {filter_sql}
            """
            cur.execute(query, [snapshot_id] + params)
            r = cur.fetchone()
            if not r:
                return {}
            return {
                "less than 1 year": r['bucket_less_1'] or 0,
                "1-2 yrs": r['bucket_1_2'] or 0,
                "2-4 years": r['bucket_2_4'] or 0,
                "4-10 yrs": r['bucket_4_plus'] or 0
            }
            
        elif widget_id == 'attrition_type_breakdown':
            query = f"""
                SELECT 
                    employee_type, 
                    COUNT(*) AS count 
                FROM processed_data 
                WHERE snapshot_id = %s {filter_sql}
                GROUP BY employee_type
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            counts = {"Onroll": 0, "Consultant": 0, "Intern": 0}
            for r in rows:
                t = r['employee_type']
                if t in counts:
                    counts[t] = r['count']
            return counts
            
        elif widget_id == 'attrition_reasons_total':
            # Count and percentages for all exit reasons sorted descending
            query = f"""
                SELECT 
                    separation_reason AS reason,
                    COUNT(*) AS count
                FROM processed_data 
                WHERE snapshot_id = %s {filter_sql}
                GROUP BY separation_reason
                ORDER BY count DESC
            """
            cur.execute(query, [snapshot_id] + params)
            rows = cur.fetchall()
            total_query = f"SELECT COUNT(*) AS total FROM processed_data WHERE snapshot_id = %s {filter_sql}"
            cur.execute(total_query, [snapshot_id] + params)
            tot_row = cur.fetchone()
            total_exits = tot_row['total'] if tot_row else 1
            if total_exits == 0:
                total_exits = 1
                
            return [
                {
                    "reason": r['reason'] or "Unassigned",
                    "count": r['count'],
                    "pct": round((r['count'] / total_exits) * 100, 1)
                }
                for r in rows
            ]
            
        elif widget_id == 'attrition_monthly_rate':
            # Rolling Monthly Attrition Rate computed working backwards
            filters_no_month = {k: v for k, v in filters.items() if k != 'month'}
            filter_sql_no_month, params_no_month = build_filter_clause(filters_no_month)
            
            query = f"""
                SELECT 
                    TO_CHAR(dol, 'YYYY-MM') AS ym,
                    TO_CHAR(dol, 'FMMonth YYYY') AS label,
                    COUNT(*) AS exit_count
                FROM processed_data 
                WHERE snapshot_id = %s AND dol IS NOT NULL {filter_sql_no_month}
                GROUP BY ym, label
                ORDER BY ym ASC
            """
            cur.execute(query, [snapshot_id] + params_no_month)
            rows = cur.fetchall()
            
            final_hc = get_filtered_headcount(cur, snapshot_id, filters_no_month)
            current_hc = final_hc
            
            table_rows = []
            for r in reversed(rows):
                exit_count = r['exit_count']
                start_hc = current_hc + exit_count
                rate = ((exit_count / start_hc) * 100) if start_hc > 0 else 0.0
                table_rows.insert(0, {
                    "monthLabel": r['label'],
                    "startHeadcount": start_hc,
                    "exitCount": exit_count,
                    "rate": round(rate, 1)
                })
                current_hc = start_hc
            return table_rows
            
        elif widget_id == 'top_exit_reasons_component':
            # Sub-component reasons list filtered by tab (voluntary/involuntary) and single plName dropdown
            reasons_tab = filters.get("reasons_tab", "voluntary").title()
            reasons_pl = filters.get("reasons_pl", "All")
            
            # Rebuild a clean filter dict for this query
            sub_filters = {
                "gender": filters.get("gender", []),
                "employee_type": filters.get("employee_type", []),
                "hrbp_lead": filters.get("hrbp_lead", []),
                "year": filters.get("year", []),
                "month": filters.get("month", [])
            }
            if reasons_pl != "All":
                sub_filters["pl_name"] = [reasons_pl]
                
            sub_sql, sub_params = build_filter_clause(sub_filters)
            
            query = f"""
                SELECT 
                    separation_reason AS reason,
                    COUNT(*) AS count
                FROM processed_data 
                WHERE snapshot_id = %s AND exit_type = %s {sub_sql}
                GROUP BY separation_reason
                ORDER BY count DESC
            """
            cur.execute(query, [snapshot_id, reasons_tab] + sub_params)
            rows = cur.fetchall()
            return [
                {
                    "reason": r['reason'] or "Unassigned",
                    "count": r['count']
                }
                for r in rows
            ]
            
        return {"error": "Invalid widget ID"}
    finally:
        cur.close()
        conn.close()

def get_raw_exit_list(filters):
    conn = get_connection()
    cur = conn.cursor()
    try:
        snapshot_id = get_active_snapshot(cur)
        if not snapshot_id:
            return []
            
        filter_sql, params = build_filter_clause(filters)
        query = f"""
            SELECT 
                employee_id AS "employeeId",
                name,
                gender,
                employee_type AS "employeeType",
                hrbp_lead AS "hrbpLead",
                pl_name AS "plName",
                TO_CHAR(dol, 'YYYY-MM-DD') AS "lastWorkingDay",
                TO_CHAR(dol, 'YYYY-MM-DD') AS "exitDate",
                TO_CHAR(dol, 'FMMonth') AS "month",
                ff_status AS "ffStatus",
                ff_ageing AS ageing,
                clearance_status AS "clearanceStatus",
                COALESCE(final_ff_amount_ae, 0)::FLOAT AS "settlementAmount",
                exit_type AS "exitType",
                tenure_months AS "tenureMonths",
                is_regrettable AS "isRegrettable",
                is_dropout AS "isDropout",
                separation_reason AS "reasonForLeaving",
                TO_CHAR(dor, 'YYYY-MM-DD') AS "resignationDate",
                TO_CHAR(final_ff_closure_date, 'YYYY-MM-DD') AS "closureDate",
                TO_CHAR(last_ndc_triggered_date, 'YYYY-MM-DD') AS "lastNdcTriggeredDate",
                COALESCE(ff_amount_aa, 0)::FLOAT AS "ffAmountAA",
                COALESCE(final_ff_amount_ae, 0)::FLOAT AS "finalAmountAE",
                TO_CHAR(ff_payment_date, 'YYYY-MM-DD') AS "payoutDate",
                region,
                grade,
                json_build_object(
                    'hrbp', TO_CHAR(hrbp_ndc_date, 'YYYY-MM-DD'),
                    'it', TO_CHAR(it_ndc_date, 'YYYY-MM-DD'),
                    'finance', TO_CHAR(finance_ndc_date, 'YYYY-MM-DD'),
                    'admin', TO_CHAR(admin_ndc_date, 'YYYY-MM-DD')
                ) AS "clearanceDates"
            FROM processed_data
            WHERE snapshot_id = %s {filter_sql}
            ORDER BY dol DESC
        """
        cur.execute(query, [snapshot_id] + params)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

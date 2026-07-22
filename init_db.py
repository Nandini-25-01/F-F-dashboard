import os
import json
import psycopg2
from psycopg2.extras import Json

DB_USER = "Hp"
DB_PASSWORD = "fnfdashboard"
DB_HOST = "localhost"
DB_PORT = "5432"
DEFAULT_DB = "postgres"
TARGET_DB = "ff_dashboard"

def get_connection(dbname=DEFAULT_DB):
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=dbname
    )

def init_database():
    print(f"Connecting to database cluster...")
    # Step 1: Create database if not exists
    conn = get_connection(DEFAULT_DB)
    conn.autocommit = True
    cur = conn.cursor()
    
    cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{TARGET_DB}'")
    exists = cur.fetchone()
    if not exists:
        print(f"Database '{TARGET_DB}' does not exist. Creating...")
        cur.execute(f"CREATE DATABASE {TARGET_DB}")
    else:
        print(f"Database '{TARGET_DB}' already exists.")
    
    cur.close()
    conn.close()

    # Step 2: Connect to target database and create tables
    conn = get_connection(TARGET_DB)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Create database structure cleanly
    cur.execute("DROP TABLE IF EXISTS raw_sheet_data CASCADE")
    cur.execute("DROP TABLE IF EXISTS processed_data CASCADE")
    cur.execute("DROP TABLE IF EXISTS active_snapshot CASCADE")
    cur.execute("DROP TABLE IF EXISTS sync_history CASCADE")
    cur.execute("DROP TABLE IF EXISTS widget_configs CASCADE")
    cur.execute("DROP TABLE IF EXISTS sync_config CASCADE")

    # 1. Raw Sheet Data
    cur.execute("""
        CREATE TABLE raw_sheet_data (
            id SERIAL PRIMARY KEY,
            sheet_name VARCHAR(100) NOT NULL,
            row_data JSONB NOT NULL,
            sync_timestamp TIMESTAMP DEFAULT NOW(),
            snapshot_id VARCHAR(100) NOT NULL
        )
    """)
    
    # 2. Processed Data
    cur.execute("""
        CREATE TABLE processed_data (
            id SERIAL PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            name VARCHAR(200),
            gender VARCHAR(20),
            employee_type VARCHAR(50),
            hrbp_lead VARCHAR(100),
            pl_name VARCHAR(100),
            doj DATE,
            dol DATE,
            dor DATE,
            last_ndc_triggered_date DATE,
            hrbp_ndc_date DATE,
            it_ndc_date DATE,
            finance_ndc_date DATE,
            admin_ndc_date DATE,
            highest_ndc_date DATE,
            final_ff_closure_date DATE,
            ff_payment_date DATE,
            ff_amount_aa NUMERIC,
            final_ff_amount_ae NUMERIC,
            ff_status VARCHAR(50),
            ff_ageing INTEGER,
            notice_period_serve_days INTEGER,
            region VARCHAR(50),
            grade VARCHAR(50),
            exit_type VARCHAR(50),
            tenure_months INTEGER,
            is_regrettable BOOLEAN,
            is_dropout BOOLEAN,
            separation_reason VARCHAR(200),
            clearance_status VARCHAR(50),
            snapshot_id VARCHAR(100) NOT NULL
        )
    """)
    
    # 3. Active Snapshot pointer
    cur.execute("""
        CREATE TABLE active_snapshot (
            id SERIAL PRIMARY KEY,
            active_snapshot_id VARCHAR(100),
            last_successful_sync TIMESTAMP
        )
    """)
    
    # 4. Sync History
    cur.execute("""
        CREATE TABLE sync_history (
            id SERIAL PRIMARY KEY,
            sync_time TIMESTAMP DEFAULT NOW(),
            status VARCHAR(20) NOT NULL,
            rows_read INTEGER DEFAULT 0,
            rows_inserted INTEGER DEFAULT 0,
            error_message TEXT
        )
    """)
    
    # 5. Widget Formula Configurations
    cur.execute("""
        CREATE TABLE widget_configs (
            widget_id VARCHAR(100) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            config_data JSONB NOT NULL
        )
    """)

    # 6. Sync Config
    cur.execute("""
        CREATE TABLE sync_config (
            id SERIAL PRIMARY KEY,
            spreadsheet_id VARCHAR(100) NOT NULL
        )
    """)
    cur.execute("INSERT INTO sync_config (spreadsheet_id) VALUES (%s)", ("1nogDCTfDCqIjg8kHu42GoVjUqU6zEwwq30zQ1BbXmjM",))
    
    # Create indexes for optimization
    print("Creating indexes for query speed...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_raw_snapshot ON raw_sheet_data(snapshot_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_proc_snapshot ON processed_data(snapshot_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_proc_filters ON processed_data(snapshot_id, pl_name, hrbp_lead, employee_type, gender, dol)")
    
    # Populate widget configurations from formula.json
    formula_path = "node_modules/formula.json"
    if os.path.exists(formula_path):
        print(f"Loading widget configs from {formula_path}...")
        with open(formula_path, 'r') as f:
            data = json.load(f)
            widgets = data.get("widgets", [])
            for w in widgets:
                widget_id = w["id"]
                title = w["title"]
                cur.execute("""
                    INSERT INTO widget_configs (widget_id, title, config_data)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (widget_id) 
                    DO UPDATE SET title = EXCLUDED.title, config_data = EXCLUDED.config_data
                """, (widget_id, title, Json(w)))
        print("Widget configurations populated successfully!")
    else:
        print(f"Warning: {formula_path} not found. Skipping widget configs populate.")

    cur.close()
    conn.close()
    print("Database initialization completed successfully!")

if __name__ == "__main__":
    init_database()

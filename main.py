import os
import asyncio
import socket
import threading
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from sync_service import sync_google_sheets
from calculation_engine import (
    get_filter_options,
    calculate_widget_data,
    get_raw_exit_list,
    DB_USER, DB_HOST, DB_PORT, TARGET_DB
)

# Set global socket timeout of 15 seconds to prevent gspread/Google API requests from hanging indefinitely
socket.setdefaulttimeout(15)

# Threading lock to prevent concurrent sync operations from deadlocking the Postgres database
sync_lock = threading.Lock()

app = FastAPI(title="F&F Settlement Dashboard Backend", version="1.0")

class FilterRequest(BaseModel):
    employee_type: Optional[List[str]] = []
    hrbp_lead: Optional[List[str]] = []
    pl_name: Optional[List[str]] = []
    gender: Optional[List[str]] = []
    year: Optional[List[str]] = []
    month: Optional[List[str]] = []
    reasons_tab: Optional[str] = "voluntary"
    reasons_pl: Optional[str] = "All"

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        dbname=TARGET_DB,
        cursor_factory=RealDictCursor
    )

# Async Background Sync Task
async def run_sync_periodically():
    # Allow server startup before initial sync
    await asyncio.sleep(5)
    while True:
        try:
            # Try to acquire lock non-blocking. Skip if another sync is currently running.
            acquired = sync_lock.acquire(blocking=False)
            if acquired:
                try:
                    print("[Background Worker] Syncing Google Sheet data...")
                    sync_google_sheets()
                finally:
                    sync_lock.release()
            else:
                print("[Background Worker] Sync skipped: lock is held by another process.")
        except Exception as e:
            print("[Background Worker] Sync task error:", e)
        # Sleep for 60 seconds
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    # Start background job
    asyncio.create_task(run_sync_periodically())

# --- REST API Endpoints ---

@app.get("/api/filters")
def api_filters():
    try:
        filters = get_filter_options()
        return JSONResponse(content=filters)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/widgets")
def api_widgets(filters: FilterRequest):
    try:
        # Convert Pydantic model to dict
        filters_dict = filters.dict()
        
        # Calculate each widget defined in formula.json
        results = {
            "total_ff_cases": calculate_widget_data("total_ff_cases", filters_dict),
            "average_tat": calculate_widget_data("average_tat", filters_dict),
            "payable_vs_recovery": calculate_widget_data("payable_vs_recovery", filters_dict),
            "total_ff_payout_by_pnl": calculate_widget_data("total_ff_payout_by_pnl", filters_dict),
            "recovery_settlement_analysis": calculate_widget_data("recovery_settlement_analysis", filters_dict),
            "ageing_bucket_breakdown": calculate_widget_data("ageing_bucket_breakdown", filters_dict),
            "ndc_clearance": calculate_widget_data("ndc_clearance", filters_dict),
            
            # Attrition widgets
            "attrition_total": calculate_widget_data("attrition_total", filters_dict),
            "attrition_rate": calculate_widget_data("attrition_rate", filters_dict),
            "attrition_regret": calculate_widget_data("attrition_regret", filters_dict),
            "attrition_tenure": calculate_widget_data("attrition_tenure", filters_dict),
            "attrition_dropout": calculate_widget_data("attrition_dropout", filters_dict),
            "attrition_by_hrbp": calculate_widget_data("attrition_by_hrbp", filters_dict),
            "attrition_voluntary_vs_involuntary": calculate_widget_data("attrition_voluntary_vs_involuntary", filters_dict),
            "attrition_tenure_distribution": calculate_widget_data("attrition_tenure_distribution", filters_dict),
            "attrition_type_breakdown": calculate_widget_data("attrition_type_breakdown", filters_dict),
            "attrition_reasons_total": calculate_widget_data("attrition_reasons_total", filters_dict),
            "attrition_monthly_rate": calculate_widget_data("attrition_monthly_rate", filters_dict),
            "top_exit_reasons_component": calculate_widget_data("top_exit_reasons_component", filters_dict)
        }
        return JSONResponse(content=results)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/raw-data")
def api_raw_data(filters: FilterRequest):
    try:
        filters_dict = filters.dict()
        data = get_raw_exit_list(filters_dict)
        return JSONResponse(content=data)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

class SyncRequest(BaseModel):
    url: Optional[str] = None

@app.post("/api/sync")
def api_sync(req: Optional[SyncRequest] = None):
    override_id = None
    if req and req.url:
        import re
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', req.url)
        if match:
            override_id = match.group(1)
        else:
            override_id = req.url.strip()
            
    # Try to acquire lock with 2-second timeout to avoid locking the thread indefinitely
    acquired = sync_lock.acquire(timeout=2.0)
    if not acquired:
        return JSONResponse(
            status_code=409, 
            content={"success": False, "error": "Another sync is currently in progress. Please try again in a few moments."}
        )
        
    try:
        success = sync_google_sheets(override_sheet_id=override_id)
        if success:
            return JSONResponse(content={"success": True})
        else:
            return JSONResponse(status_code=500, content={"success": False, "error": "Sync task failed."})
    finally:
        sync_lock.release()

@app.get("/api/sync/history")
def api_sync_history():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                TO_CHAR(sync_time, 'YYYY-MM-DD HH24:MI:SS') AS sync_time,
                status,
                rows_read,
                rows_inserted,
                error_message
            FROM sync_history 
            ORDER BY sync_time DESC 
            LIMIT 10
        """)
        history = cur.fetchall()
        
        cur.execute("SELECT last_successful_sync FROM active_snapshot LIMIT 1")
        last_row = cur.fetchone()
        last_success = last_row['last_successful_sync'].strftime('%Y-%m-%d %H:%M:%S') if last_row and last_row['last_successful_sync'] else 'Never'
        
        cur.execute("SELECT spreadsheet_id FROM sync_config LIMIT 1")
        config_row = cur.fetchone()
        sheet_id = config_row['spreadsheet_id'] if config_row else "1nogDCTfDCqIjg8kHu42GoVjUqU6zEwwq30zQ1BbXmjM"
        
        return JSONResponse(content={
            "last_success": last_success,
            "spreadsheet_id": sheet_id,
            "history": history
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        cur.close()
        conn.close()

# --- Static Files Wildcard Routing ---

@app.get("/{filename}")
def get_static(filename: str):
    filepath = os.path.join(".", filename)
    if os.path.isfile(filepath):
        return FileResponse(filepath)
    return FileResponse("index.html")

@app.get("/")
def get_index():
    return FileResponse("index.html")

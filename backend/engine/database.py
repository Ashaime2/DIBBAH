import os
import sqlite3
import pandas as pd
from typing import Optional

# Path configuration
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "market_data.sqlite")

def get_connection() -> sqlite3.Connection:
    """Returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema if it doesn't exist."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create the table for OHLCV data
    # We use a composite primary key to ensure no duplicate rows for the same ticker/interval/date
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ohlcv_data (
            ticker TEXT NOT NULL,
            interval TEXT NOT NULL,
            date TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            PRIMARY KEY (ticker, interval, date)
        )
    ''')
    
    # Create an index for faster querying by ticker and interval
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_ticker_interval_date 
        ON ohlcv_data (ticker, interval, date)
    ''')
    
    conn.commit()
    conn.close()

def save_market_data(df: pd.DataFrame, ticker: str, interval: str):
    """
    Saves a dataframe of market data into the SQLite database.
    Uses 'replace' or insert ignore logic to avoid duplicates.
    """
    if df.empty:
        return
        
    conn = get_connection()
    
    # Prepare dataframe for SQL
    # Ensure it only has the columns we want
    cols = ['date', 'open', 'high', 'low', 'close', 'volume']
    insert_df = df.copy()
    
    # Format date as string for SQLite
    if pd.api.types.is_datetime64_any_dtype(insert_df['date']):
        insert_df['date'] = insert_df['date'].dt.strftime('%Y-%m-%d %H:%M:%S')
    else:
        # Precautionarily cast to string
        insert_df['date'] = insert_df['date'].astype(str)
        
    insert_df['ticker'] = ticker.upper()
    insert_df['interval'] = interval
    
    # We only want the matching columns for the DB (except primary keys handled by pandas if using to_sql, but pandas to_sql doesn't support UPSERT natively well in sqlite without chunks)
    # Instead, we convert to list of tuples and run executemany with INSERT OR IGNORE / REPLACE
    records = insert_df[['ticker', 'interval', 'date', 'open', 'high', 'low', 'close', 'volume']].values.tolist()
    
    cursor = conn.cursor()
    cursor.executemany('''
        INSERT OR REPLACE INTO ohlcv_data 
        (ticker, interval, date, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', records)
    
    conn.commit()
    conn.close()

def load_market_data(ticker: str, interval: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.DataFrame:
    """
    Loads market data from the SQLite database.
    Returns an empty dataframe if no data matches.
    """
    conn = get_connection()
    
    query = "SELECT date, open, high, low, close, volume FROM ohlcv_data WHERE ticker = ? AND interval = ?"
    params = [ticker.upper(), interval]
    
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
        
    query += " ORDER BY date ASC"
    
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    
    if not df.empty:
        # Convert date string back to datetime object
        df['date'] = pd.to_datetime(df['date'])
        
    return df

# Initialize on import
init_db()

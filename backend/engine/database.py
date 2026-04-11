import os
import pandas as pd
from typing import Optional
from sqlalchemy import create_engine, MetaData, Table, Column, String, Float
from sqlalchemy.dialects.postgresql import insert
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

DB_URL = os.getenv("DATABASE_URL")

# Create engine if DB_URL is available
engine = None
if DB_URL:
    # Append the async driver or just use psycopg2 depending on the connection string
    # Supabase gives postgresql:// format which psycopg2 natively accepts via sqlalchemy
    engine = create_engine(DB_URL, pool_size=10, max_overflow=20)

metadata = MetaData()

# Define the table schema matching the previous SQLite one
ohlcv_data = Table(
    'ohlcv_data', metadata,
    Column('ticker', String, primary_key=True),
    Column('interval', String, primary_key=True),
    Column('date', String, primary_key=True),
    Column('open', Float),
    Column('high', Float),
    Column('low', Float),
    Column('close', Float),
    Column('volume', Float)
)

def init_db():
    """Initializes the database schema if it doesn't exist."""
    if not engine:
        print("Warning: No DATABASE_URL found. Database is disabled.")
        return
    # Create tables
    metadata.create_all(engine)

def save_market_data(df: pd.DataFrame, ticker: str, interval: str):
    """
    Saves a dataframe of market data into the Supabase PostgreSQL database.
    Uses PostgreSQL 'ON CONFLICT DO UPDATE' to elegantly handle duplicates.
    """
    if df.empty or not engine:
        return
        
    insert_df = df.copy()
    
    # Format date as string for DB
    if pd.api.types.is_datetime64_any_dtype(insert_df['date']):
        insert_df['date'] = insert_df['date'].dt.strftime('%Y-%m-%d %H:%M:%S')
    else:
        insert_df['date'] = insert_df['date'].astype(str)
        
    insert_df['ticker'] = ticker.upper()
    insert_df['interval'] = interval
    
    # Format to list of dictionaries for SQLAlchemy execution
    # Explicitly select only the 8 columns that match the table schema
    db_cols = ['ticker', 'interval', 'date', 'open', 'high', 'low', 'close', 'volume']
    records = insert_df[db_cols].to_dict(orient='records')
    
    # Build Postgres UPSERT statement
    stmt = insert(ohlcv_data).values(records)
    
    # On conflict (primary key constraint), we update the OHLCV values
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=['ticker', 'interval', 'date'],
        set_=dict(
            open=stmt.excluded.open,
            high=stmt.excluded.high,
            low=stmt.excluded.low,
            close=stmt.excluded.close,
            volume=stmt.excluded.volume
        )
    )
    
    with engine.begin() as conn:
        conn.execute(upsert_stmt)

def load_market_data(ticker: str, interval: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.DataFrame:
    """
    Loads market data from the PostgreSQL database into a Pandas DataFrame.
    """
    if not engine:
        return pd.DataFrame()
        
    query = "SELECT date, open, high, low, close, volume FROM ohlcv_data WHERE ticker = %(ticker)s AND interval = %(interval)s"
    params = {'ticker': ticker.upper(), 'interval': interval}
    
    if start_date:
        query += " AND date >= %(start_date)s"
        params['start_date'] = start_date
    if end_date:
        query += " AND date <= %(end_date)s"
        params['end_date'] = end_date
        
    query += " ORDER BY date ASC"
    
    try:
        with engine.connect() as conn:
            df = pd.read_sql_query(query, conn, params=params)
            
        if not df.empty:
            df['date'] = pd.to_datetime(df['date'])
        return df
    except Exception as e:
        print(f"Error loading market data from Supabase: {e}")
        return pd.DataFrame()

# Initialize on import
init_db()

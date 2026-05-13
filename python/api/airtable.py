# https://airtable.com/create/tokens

import os

import pandas as pd
from dotenv import load_dotenv
from pyairtable import Api

# Load environment variables from .env file
load_dotenv()

# Initialize Airtable API connection
_api_key = os.environ.get("AIRTABLE_API_KEY")
if not _api_key:
    raise EnvironmentError("AIRTABLE_API_KEY is not set. Add it to your .env file.")
api = Api(_api_key)


def fetch_airtable_table(table_id: str, base_id: str) -> pd.DataFrame:
    """
    Fetch all records from an Airtable table and return as a pandas DataFrame.

    Args:
        table_id: The ID of the Airtable table
        base_id: The ID of the Airtable base. Uses AIRTABLE_BASE_ID from .env by default.

    Returns:
        DataFrame containing all records from the table

    Raises:
        ValueError: If no records found in the table.
    """
    table = api.table(
        base_id,
        table_id,
    )

    # cell_format="json" is the pyairtable default — attachment fields come as lists of dicts
    records = table.all()

    if not records:
        raise ValueError(f"No records found in Airtable table {table_id}")

    data = [record["fields"] for record in records]
    return pd.DataFrame(data)

# %% selecting interpreter
import sys

print("Interpreter:", sys.executable)

import requests

print("requests OK")

from python.api.airtable import fetch_airtable_table

print("airtable import OK")


# %% imports
import json
from pathlib import Path
from urllib.parse import urlparse

import requests

from python.api.airtable import fetch_airtable_table
from python.utils.utils import export_dataframe

# %% keys/constants
AIRTABLE_BASE_ID = "appIYFN5sAJzK1bPg"
PARTNER_TABLE_ID = "tbl2FMZOARI7I66fq"
PROJECTS_TABLE_ID = "tblgfDfV8s3mXHbUh"


# %% Output Directory paths
RAW_DIR = Path("data") / "raw"
PROCESSED_DIR = Path("data") / "processed"
PUBLIC_DATA_DIR = Path("public") / "data"
PUBLIC_LOGOS_DIR = Path("public") / "logos"

for d in [RAW_DIR, PROCESSED_DIR, PUBLIC_DATA_DIR, PUBLIC_LOGOS_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# %% Using airtable.py

df_parners_registry = fetch_airtable_table(
    table_id=PARTNER_TABLE_ID,
    base_id=AIRTABLE_BASE_ID,
)

df_projects = fetch_airtable_table(
    table_id=PROJECTS_TABLE_ID,
    base_id=AIRTABLE_BASE_ID,
)

# %% Qhat do we have

print(df_parners_registry)
print(df_projects)


# %% Renaming for convention

# Rename columns to snake_case naming convention
rename_mapping = {
    "Organization name": "org_full_name",
    "Short name": "org_short_name",
    "Organization Type": "org_type",
    "CRAF'd partner type": "partner_type",
    "Projects (Lead)": "projects_lead",
    "UN-Organization": "un_org",
    "Projects (Support)": "projects_support",
    # adding financing columns here:
    # this is from incoming:
    # "Contributing Country": "contributing_country",
    # "Amount": "amount",
    # this is from Projects:
    "Project title": "project_title",
    "Project short title": "project_short_title",
    "Investment type": "investment_type",
    "Exact Grant Size": "grant_amt",
    "Lead organization": "org_full_name",
    "Organization": "org_short_name",
}


df_parners_registry = df_parners_registry.rename(columns=rename_mapping)

df_parners_registry = df_parners_registry.sort_values("org_short_name").reset_index(
    drop=True
)


# %% same for projects df, but sort by lead org for now

df_projects = df_projects.rename(columns=rename_mapping)

df_projects = df_projects.reset_index(drop=True)


# %% reducing what I want in the dfs
selected_columns_project = [
    "project_title",
    "project_short_title",
    "investment_type",
    "grant_amt",
    "org_full_name",
    "org_short_name",
]
selected_columns_partners = [
    "org_full_name",
    "org_short_name",
    "org_type",
    "projects_lead",
    "un_org",
]

df_projects = df_projects[selected_columns_project]
df_parners_registry = df_parners_registry[selected_columns_partners]


# %% Export intermediates for 02_transform_financing.py
# Pickle/CSV go to data/processed/ (for inspection); JSON go to data/raw/ (pipeline input).

output_dir = Path("data") / "processed"
export_dataframe(df_projects, "df_projects", output_dir)
export_dataframe(df_parners_registry, "df_parners_registry", output_dir)

raw_dir = Path("data") / "raw"
raw_dir.mkdir(parents=True, exist_ok=True)
df_projects.to_json(raw_dir / "df_projects.json", orient="records", indent=2)
df_parners_registry.to_json(
    raw_dir / "df_parners_registry.json", orient="records", indent=2
)
print(f"✓ Wrote intermediates to {raw_dir}")

# %%
# %% DONT RUN THIS--dont need logos for now


# Download logos
def download_logo(row):
    """Download logo from Airtable URL and save to public/logos/"""
    logo_data = row["org_logo_white"]
    org_name = row["org_short_name"]

    # Skip if no logo URL or org name
    if not logo_data or not org_name:
        return None

    try:
        # Handle Airtable attachment format - it's a string with filename and URL
        # Format: "filename.ext (https://url)"
        logo_url = None
        ext = None

        if isinstance(logo_data, str):
            # Extract URL from format "filename (url)"
            if "(" in logo_data and ")" in logo_data:
                start = logo_data.rfind("(")
                end = logo_data.rfind(")")
                logo_url = logo_data[start + 1 : end]

                # Extract extension from filename part
                filename_part = logo_data[:start].strip()
                ext = Path(filename_part).suffix
            else:
                # Assume it's just a URL
                logo_url = logo_data

        if not logo_url:
            return None

        # Get file extension from URL if not found in filename
        if not ext:
            parsed_url = urlparse(logo_url)
            path = parsed_url.path
            ext = Path(path).suffix

        # If still no extension found, default to .png
        if not ext:
            ext = ".png"

        # Create logos directory
        logos_dir = Path("public") / "logos"
        logos_dir.mkdir(parents=True, exist_ok=True)

        # Create web-friendly filename (lowercase, hyphens, no special chars)
        safe_name = (
            org_name.lower()
            .replace(" ", "-")
            .replace("/", "-")
            .replace("_", "-")
            .replace("&", "")
            .replace("(", "")
            .replace(")", "")
            .replace(",", "")
        )
        # Ensure extension is lowercase too
        ext = ext.lower()
        filename = f"{safe_name}{ext}"
        filepath = logos_dir / filename

        # Download and save
        response = requests.get(logo_url, timeout=30)
        response.raise_for_status()

        with open(filepath, "wb") as f:
            f.write(response.content)

        print(f"✓ Downloaded logo for {org_name}")

        # Return relative path for use in web app
        return f"/logos/{filename}"

    except Exception as e:
        print(f"✗ Error downloading logo for {org_name}: {e}")
        return None


# Apply download function to each row
df_financing["logo_path"] = df_financing.apply(download_logo, axis=1)


# this is some other way to export, not exporting in these ways as of now:
# %%

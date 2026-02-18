from pathlib import Path
from urllib.parse import urlparse

import requests

from python.api.airtable import fetch_airtable_table
from python.utils.utils import export_dataframe
import json

AIRTABLE_BASE_ID = "appIYFN5sAJzK1bPg"
PARTNER_TABLE_ID = "tbl2FMZOARI7I66fq"

df_partners = fetch_airtable_table(table_id=PARTNER_TABLE_ID, base_id=AIRTABLE_BASE_ID)


# Rename columns to snake_case naming convention
rename_mapping = {
    "Organization – Full Name": "org_full_name",
    "Organization – Short Name": "org_short_name",
    "CRAFd Connection": "crafd_connection",
    "Is CRAFd Project": "is_crafd_project",
    "Organization Type": "organization_type",
    "UN-Organization": "un_organization",
    "Website": "website",
    "Source": "source",
    "Ecosystem Stakeholder Type": "ecosystem_stakeholder_type",
    "Total Project Grant Size": "total_project_grant_size",
    "Projects (Support)": "projects_support",
    "Operating Country": "operating_country",
    "Type of organization": "type_of_organization",
    "Contacts": "contacts",
    "Comments/Notes": "comments_notes",
    "Women-Led/Feminist": "women_led_feminist",
    "Global South?": "global_south",
    "Year MoU/ Agreement Signed": "year_mou_agreement_signed",
    "MOU/ FA signing date": "mou_fa_signing_date",
    "Organization – Department": "organization_department",
    "HACT Assessment Date": "hact_assessment_date",
    "Exact Grant Size": "exact_grant_size",
    "Job Posting Website": "job_posting_website",
    "Projects (Lead)": "projects_lead",
    "Projects": "projects",
    "Received Grants": "received_grants",
    "Organization Logo White": "org_logo_white",
    "Organization Logo Color": "org_logo_color",
}

df_partners = df_partners.rename(columns=rename_mapping)

df_partners = df_partners.sort_values("org_short_name").reset_index(drop=True)


selected_columns = [
    "org_short_name",
    "org_full_name",
    "crafd_connection",
    "org_logo_white",
]

df_partners = df_partners[selected_columns]


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
df_partners["logo_path"] = df_partners.apply(download_logo, axis=1)


output_dir = Path("data") / "processed"
export_dataframe(df_partners, "df_leads", output_dir)


# Export to JSON for website use
public_dir = Path("public") / "data"
public_dir.mkdir(parents=True, exist_ok=True)

df_partners.to_json(public_dir / "partners.json", orient="records", indent=2)

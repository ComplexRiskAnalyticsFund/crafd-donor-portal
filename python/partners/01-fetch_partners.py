from pathlib import Path
from urllib.parse import urlparse

import requests

from python.api.airtable import fetch_airtable_table
from python.utils.utils import export_dataframe

AIRTABLE_BASE_ID = "appIYFN5sAJzK1bPg"
PARTNER_TABLE_ID = "tbl2FMZOARI7I66fq"
PROJECT_TABLE_ID = "tblgfDfV8s3mXHbUh"
df_partners = fetch_airtable_table(table_id=PARTNER_TABLE_ID, base_id=AIRTABLE_BASE_ID)

print("Airtable columns:", list(df_partners.columns))
print(f"Total rows fetched: {len(df_partners)}")

rename_mapping = {
    "Organization name":         "org_full_name",
    "Short name":                "org_short_name",
    "CRAF'd partner type":       "crafd_connection",
    "Support for CRAF'd projects": "relational_project",
    "Organization logo (BW)":    "org_logo_white",
    "Organization logo (color)": "org_logo_color",
}

df_partners = df_partners.rename(columns=rename_mapping)
df_partners = df_partners.sort_values("org_short_name").reset_index(drop=True)


def parse_airtable_attachment(logo_data):
    """
    Parse Airtable attachment string.
    Formats seen:
      "filename.ext (https://url)"   <- most common
      "https://url"                  <- bare URL
    Returns (url, extension) or (None, None).
    """
    if not logo_data or not isinstance(logo_data, str):
        return None, None

    logo_url = None
    ext = None

    if "(" in logo_data and ")" in logo_data:
        start = logo_data.rfind("(")
        end = logo_data.rfind(")")
        logo_url = logo_data[start + 1:end].strip()
        filename_part = logo_data[:start].strip()
        ext = Path(filename_part).suffix
    else:
        logo_url = logo_data.strip()

    if not ext:
        parsed = urlparse(logo_url or "")
        ext = Path(parsed.path).suffix

    if not ext:
        ext = ".png"

    return logo_url, ext.lower()


def to_slug(name):
    return (
        name.strip()
        .lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("_", "-")
        .replace("&", "")
        .replace("(", "")
        .replace(")", "")
        .replace(",", "")
    )


def download_logo(logo_data, org_name, dest_dir):
    """Download a logo and return its web path, or None on failure."""
    if not isinstance(org_name, str) or not org_name.strip():
        return None
    if not logo_data or not isinstance(logo_data, str):
        return None

    logo_url, ext = parse_airtable_attachment(logo_data)
    if not logo_url:
        return None

    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{to_slug(org_name)}{ext}"
    filepath = dest_dir / filename

    try:
        response = requests.get(logo_url, timeout=30)
        response.raise_for_status()
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"  + {org_name}")
        rel = str(dest_dir.relative_to(Path("public"))).replace("\\", "/")
        return f"/{rel}/{filename}"
    except Exception as e:
        print(f"  x {org_name}: {e}")
        return None


# -- Download white (BW) logos -> public/white_logos/ -------------------------
print("\nDownloading white logos -> public/white_logos/")
white_dir = Path("public") / "white_logos"
df_partners["logo_path"] = df_partners.apply(
    lambda row: download_logo(
        row.get("org_logo_white"), row.get("org_short_name", ""), white_dir
    ),
    axis=1,
)

# -- Download color logos -> public/logos/color/ ------------------------------
print("\nDownloading color logos -> public/logos/color/")
color_dir = Path("public") / "logos" / "color"
df_partners["color_logo_path"] = df_partners.apply(
    lambda row: download_logo(
        row.get("org_logo_color"), row.get("org_short_name", ""), color_dir
    ),
    axis=1,
)

# -- Select output columns ----------------------------------------------------
selected_columns = [
    "org_short_name",
    "org_full_name",
    "crafd_connection",
    "relational_project",
    "org_logo_white",
    "logo_path",
]

df_out = df_partners[selected_columns].copy()

# -- Export -------------------------------------------------------------------
output_dir = Path("data") / "processed"
export_dataframe(df_out, "df_partners", output_dir)

public_dir = Path("public") / "data"
public_dir.mkdir(parents=True, exist_ok=True)
df_out.to_json(public_dir / "partners.json", orient="records", indent=2)
print(f"\n+ Exported public/data/partners.json ({len(df_out)} records)")

# -- Verification -------------------------------------------------------------
print("\n-- Verification --")
rp = df_out["relational_project"].dropna()
rp = rp[rp.str.strip() != ""]
print(f"relational_project populated: {len(rp)} of {len(df_out)}")
print("Unique values:")
for v in sorted(rp.unique()):
    count = (df_out["relational_project"] == v).sum()
    print(f"  {v!r}  ({count} partners)")

white_downloaded = df_out["logo_path"].notna().sum()
print(f"\nWhite logos downloaded: {white_downloaded} of {len(df_out)}")

color_downloaded = df_partners["color_logo_path"].notna().sum()
print(f"Color logos downloaded: {color_downloaded} of {len(df_partners)}")

# -- Fetch projects -> public/data/projects.json ------------------------------
print("\nFetching projects table...")
df_projects = fetch_airtable_table(table_id=PROJECT_TABLE_ID, base_id=AIRTABLE_BASE_ID)
print(f"Projects fetched: {len(df_projects)}")

projects_rename = {
    "Project title":           "project_short_title",  # join key — matches relational_project values
    "Project short title":     "project_label",        # "Org: ProjectName" concise display
    "Full title":              "full_title",            # long descriptive title
    "Project blurbs":          "project_blurb",
    "CRAF'd project URL":      "project_url",
    "Exact grant size":        "grant_size",
    "Project status":          "project_status",
    "Project duration (mos.)": "duration_months",
    "Project coverage":        "project_coverage",
}
df_projects = df_projects.rename(columns=projects_rename)

selected_project_columns = [
    "project_short_title", "project_label", "full_title", "project_blurb",
    "project_url", "grant_size", "project_status",
    "duration_months", "project_coverage",
]
# Only keep columns that exist (safe if Airtable renames a field)
available = [c for c in selected_project_columns if c in df_projects.columns]
df_projects_out = df_projects[available].copy()

# Drop rows with no join key
df_projects_out = df_projects_out[
    df_projects_out["project_short_title"].notna() &
    (df_projects_out["project_short_title"].str.strip() != "")
].reset_index(drop=True)

df_projects_out.to_json(public_dir / "projects.json", orient="records", indent=2)
print(f"+ Exported public/data/projects.json ({len(df_projects_out)} projects)")
print("Projects exported:")
for t in df_projects_out["project_short_title"]:
    print(f"  {t}")

import shutil
from collections import Counter
from pathlib import Path

import requests
from PIL import Image as PILImage
from tqdm import tqdm

from python.api.airtable import fetch_airtable_table
from python.utils.utils import export_dataframe

# CRAF'd Dataverse Base
AIRTABLE_BASE_ID = "appIYFN5sAJzK1bPg"

# Partner Registry
PARTNER_TABLE_ID = "tbl2FMZOARI7I66fq"
# Projects
PROJECT_TABLE_ID = "tblgfDfV8s3mXHbUh"

# Set True to wipe public/logos/partners/ and redownload everything from Airtable.
# Set False to skip files that already exist on disk (fast incremental update).
FORCE_REDOWNLOAD = True

PARTNERS_LOGO_DIR = Path("public") / "logos" / "partners"

if FORCE_REDOWNLOAD and PARTNERS_LOGO_DIR.exists():
    shutil.rmtree(PARTNERS_LOGO_DIR)
    tqdm.write("✓ Cleared public/logos/partners/ (FORCE_REDOWNLOAD=True)")

df_partners = fetch_airtable_table(table_id=PARTNER_TABLE_ID, base_id=AIRTABLE_BASE_ID)

tqdm.write(
    f"Fetched {len(df_partners)} partner rows — columns: {list(df_partners.columns)}"
)

rename_mapping = {
    "RECORD_ID": "airtable_id",
    "Short name": "org_short_name",
    "Organization name": "org_full_name",
    "CRAF'd partner type": "crafd_connection",
    "Support for CRAF'd projects": "relational_project",
    "Organization logo (BW)": "org_logo_white",
    "Organization logo (color)": "org_logo_color",
    "Website": "org_url",
    "Total project grant size": "total_grant_size",
    "Organization type": "org_type",
}

df_partners = df_partners.rename(columns=rename_mapping)

# In cell_format="json":
#   - linked-record fields → list of opaque Airtable record IDs — kept as-is (join key = RECORD_ID)
#   - multi-select fields  → list of string values               — keep as list
#   - single-select fields → plain string                        — leave untouched
# We store everything as native lists in JSON so TypeScript gets proper arrays.


def _ensure_list(val):
    """Coerce missing/scalar to list."""
    if isinstance(val, list):
        return val
    if val and isinstance(val, str):
        return [val]
    return []


# relational_project is a linked-record field — keep raw Airtable record IDs as join keys
if "relational_project" in df_partners.columns:
    df_partners["relational_project"] = df_partners["relational_project"].map(
        _ensure_list
    )
# crafd_connection is a multi-select — ensure it's always a list
if "crafd_connection" in df_partners.columns:
    df_partners["crafd_connection"] = df_partners["crafd_connection"].map(_ensure_list)
# org_type is a single-select string — leave as-is (no conversion needed)

df_partners = df_partners.sort_values("org_short_name").reset_index(drop=True)

# -- Warn about missing or whitespace-only short names -----------------------
if "org_short_name" in df_partners.columns:
    missing = df_partners[
        df_partners["org_short_name"].isna()
        | (df_partners["org_short_name"].astype(str).str.strip() == "")
    ]
    if not missing.empty:
        tqdm.write(
            f"\n❌ {len(missing)} row(s) missing org_short_name — fix in Airtable before re-running:"
        )
        for _, row in missing.iterrows():
            full = row.get("org_full_name")
            full = full if isinstance(full, str) else "(no full name either)"
            tqdm.write(f"  row {row.name}: full name = {full!r}")
        raise ValueError(
            f"{len(missing)} partner row(s) are missing org_short_name — see above"
        )

    dirty = df_partners["org_short_name"].dropna()
    dirty = dirty[dirty != dirty.str.strip()]
    if not dirty.empty:
        tqdm.write(
            f"\n⚠️  {len(dirty)} short name(s) have leading/trailing whitespace — fix in Airtable:"
        )
        for name in dirty:
            tqdm.write(f"  {name!r}")

    if missing.empty and dirty.empty:
        tqdm.write("✓ org_short_name: no missing or whitespace issues")

# ---------------------------------------------------------------------------
# Attachment parsing
# Airtable JSON attachment fields are lists of dicts:
#   [{url, filename, type (MIME), size, width, height, thumbnails}, ...]
# filename may carry a "Property 1=" prefix — use MIME type for extension.
# URLs are time-limited; download immediately, never persist them.
# ---------------------------------------------------------------------------

_MIME_PRIORITY = {
    "image/svg+xml": 0,
    "image/png": 1,
    "image/jpeg": 1,
    "image/jpg": 1,
    "image/webp": 2,
}
_EXT_FROM_MIME = {
    "image/svg+xml": ".svg",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}


def parse_airtable_attachment(attachments):
    """
    Pick best logo from Airtable attachment list (SVG > PNG > JPG by MIME).
    Returns (url, ext) or (None, None).
    """
    if not attachments or not isinstance(attachments, list):
        return None, None
    candidates = []
    for att in attachments:
        if not isinstance(att, dict):
            continue
        url = att.get("url")
        if not url:
            continue
        mime = att.get("type", "")
        ext = (
            _EXT_FROM_MIME.get(mime)
            or Path(att.get("filename", "")).suffix.lower()
            or ".png"
        )
        candidates.append((url, ext, _MIME_PRIORITY.get(mime, 99)))
    if not candidates:
        return None, None
    candidates.sort(key=lambda c: c[2])
    url, ext, _ = candidates[0]
    return url, ext


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


def download_logo(attachments, org_name, dest_dir):
    """Download the best-quality logo attachment and return its web path, or None."""
    if not isinstance(org_name, str) or not org_name.strip():
        return None
    if not attachments or not isinstance(attachments, list):
        return None

    logo_url, ext = parse_airtable_attachment(attachments)
    if not logo_url:
        return None

    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{to_slug(org_name)}{ext}"
    filepath = dest_dir / filename

    if not FORCE_REDOWNLOAD and filepath.exists():
        rel = str(dest_dir.relative_to(Path("public"))).replace("\\", "/")
        return f"/{rel}/{filename}"

    try:
        response = requests.get(logo_url, timeout=30)
        response.raise_for_status()
        filepath.write_bytes(response.content)
        rel = str(dest_dir.relative_to(Path("public"))).replace("\\", "/")
        return f"/{rel}/{filename}"
    except Exception as e:
        tqdm.write(f"  ✗ {org_name}: {e}")
        return None


# -- Download white (BW) logos -> public/logos/partners/white/ ---------------
white_dir = Path("public") / "logos" / "partners" / "white"
white_paths = []
with tqdm(
    df_partners.iterrows(), total=len(df_partners), desc="White logos", unit="org"
) as pbar:
    for _, row in pbar:
        name = row.get("org_short_name")
        name = name if isinstance(name, str) else ""
        pbar.set_postfix(org=name[:28], refresh=False)
        white_paths.append(download_logo(row.get("org_logo_white"), name, white_dir))
df_partners["white_logo_path"] = white_paths

# -- Download color logos -> public/logos/partners/color/ --------------------
color_dir = Path("public") / "logos" / "partners" / "color"
color_paths = []
with tqdm(
    df_partners.iterrows(), total=len(df_partners), desc="Color logos", unit="org"
) as pbar:
    for _, row in pbar:
        name = row.get("org_short_name")
        name = name if isinstance(name, str) else ""
        pbar.set_postfix(org=name[:28], refresh=False)
        color_paths.append(download_logo(row.get("org_logo_color"), name, color_dir))
df_partners["color_logo_path"] = color_paths


# -- Generate 300px WebP thumbs for raster white logos -----------------------
# SVGs are infinitely sharp — skip them; thumbs are only needed for PNG/JPG.
# Thumbs live alongside white/ and color/ (not inside white/).
THUMB_DIR = Path("public") / "logos" / "partners" / "thumb"
THUMB_DIR.mkdir(parents=True, exist_ok=True)
raster_rows = [
    row
    for _, row in df_partners.iterrows()
    if isinstance(row.get("white_logo_path"), str)
    and not row["white_logo_path"].endswith(".svg")
]
# slug → web path for generated thumbs
thumb_by_slug: dict[str, str] = {}
thumb_count = 0
with tqdm(raster_rows, desc="WebP thumbs ", unit="img") as pbar:
    for row in pbar:
        raw_name = row.get("org_short_name")
        slug = to_slug(raw_name if isinstance(raw_name, str) else "")
        if not slug:
            continue
        pbar.set_postfix(slug=slug[:24], refresh=False)
        src = Path("public") / row["white_logo_path"].lstrip("/")
        if not src.exists():
            continue
        thumb_path = THUMB_DIR / f"{slug}.webp"
        web_path = f"/logos/partners/thumb/{slug}.webp"
        if not FORCE_REDOWNLOAD and thumb_path.exists():
            thumb_by_slug[slug] = web_path
            thumb_count += 1
            continue
        try:
            img = PILImage.open(src).convert("RGBA")
            img.thumbnail((300, 300), PILImage.Resampling.LANCZOS)
            img.save(thumb_path, "webp", quality=85)
            thumb_by_slug[slug] = web_path
            thumb_count += 1
        except Exception as e:
            tqdm.write(f"  ✗ {slug}: {e}")
tqdm.write(f"  {thumb_count} thumbs generated")

# SVG white logos are already sharp at any size — use directly as thumb path.
# Raster logos use the generated WebP thumb, or None if generation failed.
df_partners["thumb_logo_path"] = [
    p
    if isinstance(p, str) and p.endswith(".svg")
    else thumb_by_slug.get(to_slug(n))
    if isinstance(p, str) and isinstance(n, str)
    else None
    for p, n in zip(df_partners["white_logo_path"], df_partners["org_short_name"])
]

# -- Select output columns ----------------------------------------------------
selected_columns = [
    "airtable_id",
    "org_short_name",
    "org_full_name",
    "crafd_connection",
    "org_type",
    "relational_project",
    "white_logo_path",
    "thumb_logo_path",
    "color_logo_path",
    "org_url",
    "total_grant_size",
]

available_partner_cols = [c for c in selected_columns if c in df_partners.columns]
df_out = df_partners[available_partner_cols].copy()

# -- Export -------------------------------------------------------------------
output_dir = Path("data") / "processed"
export_dataframe(df_out, "df_partners", output_dir)

public_dir = Path("public") / "data"
public_dir.mkdir(parents=True, exist_ok=True)
df_out.to_json(public_dir / "partners.json", orient="records", indent=2)
tqdm.write(f"\n✓ Exported public/data/partners.json ({len(df_out)} records)")

# -- Verification -------------------------------------------------------------
tqdm.write("\n── Verification ──")
rp_populated = df_out["relational_project"].apply(
    lambda x: isinstance(x, list) and len(x) > 0
)
tqdm.write(f"relational_project populated: {rp_populated.sum()} of {len(df_out)}")
proj_counts: Counter = Counter()
for projects in df_out["relational_project"].dropna():
    if isinstance(projects, list):
        proj_counts.update(projects)
for proj, count in sorted(proj_counts.items()):
    tqdm.write(f"  {proj!r}  ({count} partners)")

white_downloaded = df_out["white_logo_path"].notna().sum()
tqdm.write(f"\nWhite logos: {white_downloaded}/{len(df_out)}")
color_downloaded = df_out["color_logo_path"].notna().sum()
tqdm.write(f"Color logos: {color_downloaded}/{len(df_out)}")

# -- Fetch projects -> public/data/projects.json ------------------------------
tqdm.write("\nFetching projects table...")
df_projects = fetch_airtable_table(table_id=PROJECT_TABLE_ID, base_id=AIRTABLE_BASE_ID)
tqdm.write(f"Fetched {len(df_projects)} project rows")

projects_rename = {
    "RECORD_ID": "airtable_id",
    "Project title": "project_short_title",
    "Project short title": "project_label",
    "Full title": "full_title",
    "Project blurbs": "project_blurb",
    "CRAF'd project URL": "project_url",
    "Exact grant size": "grant_size",
    "Project status": "project_status",
    "Project duration (mos.)": "duration_months",
    "Project coverage": "project_coverage",
    "Organization full name": "linked_lead_org",  # linked partner record IDs
    "Supporting organizations": "linked_supporting_org",  # linked partner record IDs
}
df_projects = df_projects.rename(columns=projects_rename)

# Keep linked org fields as raw record ID lists
for col in ("linked_lead_org", "linked_supporting_org"):
    if col in df_projects.columns:
        df_projects[col] = df_projects[col].map(_ensure_list)

selected_project_columns = [
    "airtable_id",
    "project_short_title",
    "project_label",
    "full_title",
    "project_blurb",
    "project_url",
    "grant_size",
    "project_status",
    "duration_months",
    "project_coverage",
    "linked_lead_org",
    "linked_supporting_org",
]
available = [c for c in selected_project_columns if c in df_projects.columns]
df_projects_out = df_projects[available].copy()

df_projects_out = df_projects_out[
    df_projects_out["airtable_id"].notna()
    & (df_projects_out["airtable_id"].str.strip() != "")
].reset_index(drop=True)

df_projects_out.to_json(public_dir / "projects.json", orient="records", indent=2)
tqdm.write(f"✓ Exported public/data/projects.json ({len(df_projects_out)} projects)")
# for t in df_projects_out["project_short_title"]:
#     tqdm.write(f"  {t}")

# 02_transform_financing.py

# %% IMPORTS
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

# %% import/output PATHS

RAW_DIR = Path("data") / "raw"
PROCESSED_DIR = Path("data") / "processed"
PUBLIC_DATA_DIR = Path("public") / "data"

INPUT_PARTNERS_JSON = RAW_DIR / "df_parners_registry.json"
INPUT_PROJECTS_JSON = RAW_DIR / "df_projects.json"
INPUT_DONORS_JSON = RAW_DIR / "commitments.json"

OUTPUT_SANKEY_JSON = PUBLIC_DATA_DIR / "financing_sankey.json"  # served by the frontend
OUTPUT_EDGES_CSV = PROCESSED_DIR / "financing_edges.csv"

for d in [RAW_DIR, PROCESSED_DIR, PUBLIC_DATA_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# %% getting all the data in usable form
def consolidating_data(paths: list[Path]) -> tuple[dict, dict, dict]:
    with open(paths[0], "r") as f:
        partners = json.load(f)

    with open(paths[1], "r") as f:
        projects = json.load(f)

    with open(paths[2], "r") as f:
        donors = json.load(f)

    return partners, projects, donors


all_data = consolidating_data(
    [INPUT_PARTNERS_JSON, INPUT_PROJECTS_JSON, INPUT_DONORS_JSON]
)


partners_df = pd.DataFrame(all_data[0])
projects_df = pd.DataFrame(all_data[1])
donors_df = pd.DataFrame(all_data[2])


# A] In the sheet 'Projects'
#   a) Exact Grant Size(it's sum is my 'allocated' column.)
#   b) Investment Type
#   c) Project title
# B] In the sheet 'Partner Registry':
#   a) Organization Name
#   b) Organization Type
#   c) Projects (lead)--for mapping between [A] Projects sheet and [B] Partner registry, but this only works for the organisations that are leads in a particular project.
#   d) Projects (support)--for mapping between [A] Projects sheet and [B] Partner registry, but this only works for the organisations that are supporting a particular project.
#   e) UN Organization
#   f) Exact Grant Size And the
# C] for the first 2 columns, I already have this data that I can copy paste because it's from a different data source:
#    a) countries
#   b) Committed amounts
# And now here are the columns I want in my final sankey, after all the processing is done:
# 1. Donor countries--from C(a), becomes the first level of nodes
# 2. Committed amounts--from C(b), becomes the first level flows amount,
# 3. Contributions sum--sum of C(b), becomes second level node
# 4. Allocations -- from A(a)--just the total sum not the individual amounts, becomes second level flow+ third level node, showing that not all the contributions are allocated.
# 5. Investment types-- third level flow determined by using the investment type[A(b)] and exact grant size [A(a)] (already mapped to each other in A) and fourth level nodes that are [A(b)]
# 6. And then for the final level, I need to map both the investment types and organization types to each other based on A(c), B(c), B(d), to show the flow from investment types into the Organisation types.
# OKAY. SO. lets start with donors, because those are my first nodes.


# %%  PLAN:
# I'm gonna start with an empty df, add all the data for individual project types, then add in columns that match that project from partners, only the org types (as lead_org_type) and the un/non-un variable.

# %%some housekeeping/cleaning things--remove the rows with investment_type=='Direct costs', converting all numerical values to int and removing the $, trimming all the text in investment type and org type columns

projects_df = projects_df.query("investment_type != 'Direct costs'").dropna(how="all")
projects_df["grant_amt"] = (
    projects_df["grant_amt"].replace({"\$": "", ",": ""}, regex=True).astype(int)
)
projects_df["investment_type"] = projects_df["investment_type"].str.strip()
projects_df = projects_df.reset_index(drop=True)
partners_df["org_type"] = partners_df["org_type"].str.strip()
donors_df = donors_df.replace({"Commitments": {"\$": "", ",": ""}}, regex=True)


# %%starting w new df, adding everything I need, renaming for ease.
sankey_df = pd.DataFrame()
sankey_df["project_title"] = projects_df["project_title"]
sankey_df["project_grant_amt"] = projects_df["grant_amt"]
sankey_df["project_investment_type"] = projects_df["investment_type"]
sankey_df["project_lead_org"] = projects_df["lead_org"]


# %% Looking into partners data, lets only look at the ones that are leads according to partner

partners_df_leads = partners_df[partners_df["projects_lead"].notna()]


# great, so now, match partners_df_leads['org_short_name'] to the project_lead_org in sankey_df,
# use regex to check if partners_df_leads['org_short_name'] == what is within () in the string of project_lead_org in sankey_df,
# and if it does, then add in un_org, and org_type from partners_df_leads into sankey_df as new columns 'org_un_or_not' and '_org_type' respectively.


def match_org_types(row):
    for _, lead in partners_df_leads.iterrows():
        if re.search(
            r"\(" + re.escape(lead["org_short_name"]) + r"\)", row["project_lead_org"]
        ):
            return pd.Series([lead["un_org"], lead["org_type"]])
    return pd.Series([None, None])


sankey_df[["org_un_or_not", "org_type"]] = sankey_df.apply(match_org_types, axis=1)


# # un-women / un women and dppa and undppa need to be added in, bec of regex issue. I'm gonna add that in manually for now. but that means,  I think I have all my data, just need to convert it into a sankey format json. lets do that.
# %%
sankey_df.loc[14, "org_un_or_not"] = "YES"
sankey_df.loc[14, "org_type"] = "Intergovernmental Organization"
sankey_df.loc[17, "org_un_or_not"] = "YES"
sankey_df.loc[17, "org_type"] = "Intergovernmental Organization"


# %%nodes in inv types, org types, and country names.
# lets make a list of all the nodes in the sankey, which are the unique values in the columns: project_investment_type and org_type, and all the donor countries, and then the text 'Total Investment' and 'Total allocated'
nodes = list(
    set(sankey_df["project_investment_type"]).union(set(sankey_df["org_type"].dropna()))
)
donor_countries = donors_df["Contributor/Partner"].unique()
nodes.extend(donor_countries)


# %% flows in
# create a list of all the flows, which are the values in project_grant_amt
flows = []


# Group by project_investment_type and org_type, and sum the project_grant_amt for each combination
grouped_flows_all = sankey_df.groupby(
    ["project_investment_type", "org_type"], as_index=False
)["project_grant_amt"].sum()

for _, row in grouped_flows_all.iterrows():
    flows.append(
        {
            "source": row["org_type"],
            "target": row["project_investment_type"],
            "value": row["project_grant_amt"],
        }
    )

# adding in all the flows from donor countries to 'total investment':
for _, row in donors_df.iterrows():
    flows.append(
        {
            "source": row["Contributor/Partner"],
            "target": "Total Investment",
            "value": row["Commitments"],
        }
    )


# %%all the customised nodes/flows
# this changes based on which design is chosen:
# adding in the hex custom data in my sankey that I will handle in the viz code:
nodes.append("Total Investment")
nodes.append("Total Allocated")
committed_amounts_sum = donors_df["Commitments"].sum()
allocated_amounts_sum = sankey_df["project_grant_amt"].sum()
flows.append(
    {
        "source": "Total Investment",
        "target": "Total Allocated",
        "value": allocated_amounts_sum,
    }
)

# and then adding in allocated->orgs

org_grouped_df = sankey_df.groupby("org_type", as_index=False)[
    "project_grant_amt"
].sum()

for _, row in org_grouped_df.iterrows():
    flows.append(
        {
            "source": "Total Allocated",
            "target": row["org_type"],
            "value": row["project_grant_amt"],
        }
    )

# %%all the customised nodes/flowsand then putting it all together:
sankey_json = {"nodes": [{"name": node} for node in nodes], "links": flows}

# save the sankey_json to a file
with open(OUTPUT_SANKEY_JSON, "w") as f:
    json.dump(sankey_json, f, indent=4)


# errors:

#  trim all the texts before adding them into source/target.
# 4. The source and targets need to be indices instead of text, so I need to create a mapping of node names to indices, and then use that mapping to convert the source and target in flows to indices instead of text.


# this is the old plan code that I feel bad deleting:

# # %%starting w new df
# columns_needed_df=donors_df.copy()

# # %%clean-up/renaming
# columns_needed_df.rename(columns={'Contributor/Partner': 'donor', 'Commitments': 'donor_amt'}, inplace=True)


# # %%Okay, now, we add in grant size, project title, etc. +renaming according to the main sata point
# columns_needed_df = pd.concat([columns_needed_df, projects_df.rename(columns={'grant_amt': 'project_grant_amt', 'investment_type': 'project_investment_type'})], axis=1)


# # %% convert numbers to int

# columns_needed_df['project_grant_amt'] = columns_needed_df['project_grant_amt'].replace({'\$': '', ' ': '', ',': ''}, regex=True).astype(int)

# # %%
# # okay, lastly, everything from partners_df. this one is tricky, since my data's central unit is project. FOR NOW, let's look into each comma separated value under partners_df['projects_support'], and if it matches with columns_needed_df['project_title'], then we create a new column in columns_needed_df that answers the question: 'how much of the project grants are going into the different org_type
# # for this I need to first clean out partners_df into every comma separated value in projects_support being its own individual row.
# # then reduce it to see how many unique values there are across org_type and org_full_name

# # %%

# partners_df["projects_support"] = (
#     partners_df["projects_support"].fillna("").str.split(r"\s*,\s*")
# )

# # add a new row for each comma separated value in projects_support, and save it new column 'project_lead'
# support_long = (
#     partners_df[["org_full_name", "org_type", "projects_support", "un_org"]]
#     .explode("projects_support")
#     .rename(columns={"projects_support": "project_title"})
# )
# support_long
# # %% checking if they are now joinable--check if every project_title in support_long is in columns_needed_df project_title at least once


# missing_titles = support_long[~support_long["project_title"].isin(columns_needed_df["project_title"])]
# if not missing_titles.empty:
#     print("Missing project titles:", missing_titles["project_title"].unique())
# else:
#     print("All project titles are joinable.")

# # %% deleting some titles that I dont need for the sankey that are making it unjoinable--these are the ones that have empty project titles, and the one that is "CRAF'd Sec.Direct Cost 2022", which is a direct cost project that I dont want to include in my sankey.
# support_long = support_long[support_long["project_title"] != ""]
# support_long = support_long[support_long["project_title"] != "CRAF'd Sec.Direct Cost 2022"]
# # %% now, we have multiple columns in support_long that tell me what org_type is supporting which project_title, and I can use that to create a new column in columns_needed_df that tells me how much of the project_grant_amt is going into each org_type.
# # lets drop the columns: donor and donor_amt from  columns_needed_df, they can be added in later into the json directly
# columns_needed_df = columns_needed_df.drop(columns=['donor', 'donor_amt'])

# all_columns = columns_needed_df.join(support_long.set_index('project_title'), on='project_title', how='left')

# # now, does this help me identify the flow of project_grant_amt from the categories in project_investment_type to the categories in org_type?
# # basically, if the org_full_name is unique for the same


# # %%
# %% OLD PLAN:

# this code collects the organisation types for all partners from the chatgpt divisions, the data in the crisis data funding compass, and the partner registry in the overall dataverse airtable, and puts it together so we can make the decision of which org type categorisations we want for the overall database

# %% selecting interpreter
import sys
print("Interpreter:", sys.executable)

import requests
print("requests OK")

from python.api.airtable import fetch_airtable_table
print("airtable import OK")




#%% IMPORTS
from __future__ import annotations
from pathlib import Path
import json
import re
import pandas as pd

# data imports
from pathlib import Path
from urllib.parse import urlparse
import requests

from python.api.airtable import fetch_airtable_table
from python.utils.utils import export_dataframe
import json


# %% keys/constants
DATAVERSE_AIRTABLE_BASE_ID = "appIYFN5sAJzK1bPg"
FUNDING_COMPASS_AIRTABLE_BASE_ID = "apprObB2AsvMwfAAl"
PARTNER_TABLE_ID = "tbl2FMZOARI7I66fq"
PROJECTS_TABLE_ID = "tblgfDfV8s3mXHbUh"
CRISIS_DATA_FUNDING_COMPASS_TABLE_ID = "tblokonOdZ31WFVD4"



#%% Paths
RAW_DIR = Path("data") / "raw"
PROCESSED_DIR = Path("data") / "processed"

for d in [RAW_DIR, PROCESSED_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# %% Using airtable.py

df_parners_registry = fetch_airtable_table(table_id=PARTNER_TABLE_ID, base_id=DATAVERSE_AIRTABLE_BASE_ID, )

df_projects = fetch_airtable_table(table_id=PROJECTS_TABLE_ID, base_id=DATAVERSE_AIRTABLE_BASE_ID, )

df_crisis_data_funding_compass = fetch_airtable_table(table_id=CRISIS_DATA_FUNDING_COMPASS_TABLE_ID, base_id=FUNDING_COMPASS_AIRTABLE_BASE_ID, )

# %% What do we have

print(df_parners_registry)
print(df_projects)
print(df_crisis_data_funding_compass)


# %%PLAN:

# Okay, have all my data, now, I need the following columns in my final df:
# 1. Org name-full: org_full_name
# 2. Org short name: org_short_name
# 3. partner registry org type: partner_registry_org_type, partner_un_status
# 4. crisis data funding compass org type: crisis_data_funding_compass_org_type, compass_un_status
# 5. Projects page org type: projects_org_type, projects_un_status
# 6. chatgpt division org type-- not sure if I should add this lowkey, lets see in the end if it makes sense

# And then, as far as JOINING is concerned, I should look for columns with short names bec they are usually more standardised for regexes. 

# from df_crisis_data_funding_compass: Org Full Name, Org Short Name, Organisation Type
# from df_partners_registry: Organization name, Short name, Organization Type, UN-Organization, [?] Type of organisation
# from df_projects: Lead organization, Organization, Organization Type, UN-Organization, Type of organization (from Lead Organization)

# %% from funding compass data:
useful_columns = pd.DataFrame()
useful_columns['org_full_name'] = df_crisis_data_funding_compass['Org Full Name']
useful_columns['org_short_name'] = df_crisis_data_funding_compass['Org Short Name']
useful_columns['compass_org_type'] = df_crisis_data_funding_compass['Org Type']
useful_columns['org_key'] = df_crisis_data_funding_compass['org_key']


# %% from partner registry data:
df_parners_registry['org_key'] = df_parners_registry['Short name'].str.strip().str.lower().str.replace(r'\s+', '-', regex=True)

# %% from partner registry data:
# lets see how many match between useful_columns['org_key'] and df_parners_registry['org_key']

matches = useful_columns['org_key'].isin(df_parners_registry['org_key'])
match_count = matches.sum()

print(f"Number of matches for org_key: {match_count}")

matches2 = (useful_columns['org_full_name']
            .str.strip()
            .str.lower()
            .str.replace(r'\s+', '-', regex=True)
            .isin(df_parners_registry['Organization name'].str.strip().str.lower().str.replace(r'\s+', '-', regex=True)))
match_count2 = matches2.sum()

print(f"Number of matches for full name: {match_count2}")

matches3 = (useful_columns['org_short_name']
            .str.strip()
            .str.lower()
            .str.replace(r'\s+', '-', regex=True)
            .str.replace(':', '-', regex=True)
            .isin(df_parners_registry['Short name']
                  .str.strip()
                  .str.lower()
                  .str.replace(r'\s+', '-', regex=True)
                  .str.replace(':', '-', regex=True))
)
match_count3 = matches3.sum()

print(f"Number of matches for Short name: {match_count3}")



# %% okay. so since so many do not match, what I think I should do is, have one the matching rows on top, then the rest all below, which I can then pick up manually and place in different sheets after exporting as csv. 
# Create a new DataFrame with matching rows based on org_key
merged_df = useful_columns[useful_columns['org_key'].isin(df_parners_registry['org_key'])].copy()

# Add partner registry columns to the merged DataFrame
merged_df = merged_df.merge(df_parners_registry[['org_key', 'Organization Type', 'UN-Organization']], 
                             on='org_key', 
                             how='left', 
                             suffixes=('', '_partner_registry'))

# Display the merged DataFrame
merged_df['partner_registry_org_type'] = merged_df['Organization Type'].copy()
merged_df['partner_un_status'] = merged_df['UN-Organization'].copy()
# drop the columns ['Organization Type', 'UN-Organization'] since they are now in the right format
merged_df.drop(columns=['Organization Type', 'UN-Organization'], inplace=True)
print(merged_df)

# export merged_df to csv
merged_df.to_csv(PROCESSED_DIR / 'common_partners.csv', index=False)


# Okay, so I'm going to match on org_key, and keep those, and then 
# %% from partner registry data:
# okay, so regardless, there are only 27 in common dor all. something is fishy. 


useful_columns['partner_registry_org_type'] = df_parners_registry['Organization Type']
useful_columns['partner_un_status'] = df_parners_registry['UN-Organization']

# %% from projects
useful_columns['projects_org_type'] = df_projects['Org Type']
useful_columns['projects_un_status'] = df_projects['UN-Organization']




#!/usr/bin/env python3
"""
update_registry.py

Fetches the latest official runner registration data from the GLCL Google Sheets
and compiles a clean master runner registry in 'backend_tools/glcl_runner_registry.json'.

Covers the triad of IDs:
- GLCL Bib number
- UKA URN (permanent athlete ID)
- Parkrun Barcode (used for race finish scanning)
- Club, Name, Gender, and Bib Change history
"""

import urllib.request
import ssl
import csv
import json
import os
import datetime

try:
    import certifi
    ssl_context = ssl.create_default_context(cafile=certifi.where())
except Exception:
    ssl_context = ssl._create_unverified_context()

BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vROw7qj3-dH7tWJAwIUN2EA08zNJPJhwzO1u9SFnpq87opHEU__tUc6fKWvopgdSI8_-_PArDapcz0b/pub?output=csv&gid={gid}"

CLUBS = {
    "Caerleon Running Club": "2043458267",
    "Caldicot Running Club": "1641310956",
    "Chepstow Harriers": "306587113",
    "Fairwater Runners": "0",
    "Griffithstown Harriers": "645920422",
    "Islwyn RC": "1010001323",
    "Lliswerry Runners": "895312223",
    "Spirit of Monmouth RC": "1547803453",
    "Parc Bryn Bach RC": "1379836799",
    "Pont-Y-Pwl & District Runners": "482595184",
}

def fetch_club_csv(gid):
    url = BASE_URL.format(gid=gid)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (GLCL Runner Registry Fetcher)"}
    )
    with urllib.request.urlopen(req, context=ssl_context) as resp:
        return resp.read().decode("utf-8")

def main():
    print("Fetching GLCL official runner rosters from Google Sheets...")
    all_runners = []
    
    for club_name, gid in CLUBS.items():
        print(f"  Fetching {club_name} (gid={gid})...")
        try:
            csv_text = fetch_club_csv(gid)
        except Exception as e:
            print(f"    ERROR fetching {club_name}: {e}")
            continue
            
        lines = [l for l in csv_text.splitlines() if 'GLCL' in l or 'URN' in l or 'BARCODE' in l or l.strip()]
        reader = csv.reader(lines)
        header = [h.strip() for h in next(reader, [])]
        
        bib_idx = header.index('GLCL') if 'GLCL' in header else 0
        urn_idx = header.index('URN') if 'URN' in header else 1
        barcode_idx = header.index('BARCODE') if 'BARCODE' in header else 2
        fname_idx = header.index('FIRST NAME') if 'FIRST NAME' in header else 3
        lname_idx = header.index('LAST NAME') if 'LAST NAME' in header else 4
        club_idx = header.index('CLUB') if 'CLUB' in header else 5
        gender_idx = header.index('GENDER') if 'GENDER' in header else 6
        
        club_count = 0
        for row in reader:
            if len(row) <= max(fname_idx, lname_idx):
                continue
            fname = row[fname_idx].strip()
            lname = row[lname_idx].strip()
            if not fname and not lname:
                continue
            bib = row[bib_idx].strip()
            urn = row[urn_idx].strip() if len(row) > urn_idx else ''
            barcode = row[barcode_idx].strip() if len(row) > barcode_idx else ''
            gender = row[gender_idx].strip() if len(row) > gender_idx else ''
            assigned_club = row[club_idx].strip() if len(row) > club_idx else club_name
            changes = [row[i].strip() for i in range(7, len(row)) if row[i].strip()]
            
            all_runners.append({
                'bib': bib,
                'urn': urn,
                'barcode': barcode.upper(),
                'first_name': fname,
                'last_name': lname,
                'name': f"{fname} {lname}",
                'club': assigned_club,
                'gender': gender,
                'changes': changes
            })
            club_count += 1
            
        print(f"    -> {club_count} active runners loaded.")
        
    registry_data = {
        'updated_at': datetime.datetime.now().isoformat(),
        'source': 'https://sites.google.com/view/glclrunning-results-and-reg/home/entry-registration',
        'total_registered': len(all_runners),
        'runners': all_runners
    }
    
    out_path = os.path.join(os.path.dirname(__file__), "glcl_runner_registry.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2)
        
    print(f"\nSuccess! Successfully compiled {len(all_runners)} registered runners into '{out_path}'.")

if __name__ == "__main__":
    main()

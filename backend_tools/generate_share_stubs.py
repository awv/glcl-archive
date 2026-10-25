#!/usr/bin/env python3
"""
GLCL Archive — Social Share Stubs Generator
Generates lightweight static HTML redirect pages under /share/ for each runner.
This enables Facebook, Twitter, WhatsApp, and LinkedIn crawlers to display
rich Open Graph preview cards (with the runner's real photo, name, club, and stats)
on static hosts like GitHub Pages.
"""

import os
import sys
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_JS_PATH = BASE_DIR / "data.js"
FEATURED_PHOTOS_PATH = BASE_DIR / "assets" / "data" / "athlete_featured_photos.json"
ATHLETE_HEADERS_PATH = BASE_DIR / "assets" / "data" / "athlete_headers.json"
ATHLETE_PHOTOS_PATH = BASE_DIR / "assets" / "data" / "athlete_photos.json"
SHARE_DIR = BASE_DIR / "share"

def slugify(text):
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def get_name_key(text):
    if not text:
        return ""
    words = re.sub(r"[,\.]", "", text.lower()).split()
    return " ".join(sorted(words))

def generate_stubs():
    SHARE_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Parse race results
    print("Loading race results from data.js...")
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    json_str = content.split("window.glclResults =")[1].strip().rstrip(";")
    records = json.loads(json_str)

    # Group by runner
    runners = {}
    for r in records:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        key = get_name_key(name)
        if key not in runners:
            runners[key] = {
                "displayName": name,
                "records": [],
                "clubs": {}
            }
        runners[key]["records"].append(r)
        c = r.get("club")
        if c:
            runners[key]["clubs"][c] = runners[key]["clubs"].get(c, 0) + 1

    print(f"Loaded {len(runners)} unique runners.")

    # 2. Load photos and headers
    featured_photos = {}
    if FEATURED_PHOTOS_PATH.exists():
        with open(FEATURED_PHOTOS_PATH, "r", encoding="utf-8") as f:
            featured_photos = json.load(f)

    headers = {}
    if ATHLETE_HEADERS_PATH.exists():
        with open(ATHLETE_HEADERS_PATH, "r", encoding="utf-8") as f:
            headers = json.load(f)

    photos_db = {}
    if ATHLETE_PHOTOS_PATH.exists():
        with open(ATHLETE_PHOTOS_PATH, "r", encoding="utf-8") as f:
            photos_db = json.load(f)

    def resolve_runner_photo(display_name, club):
        n_low = display_name.lower().strip()
        c_low = (club or "").lower().strip()
        n_sorted = " ".join(sorted(re.sub(r"[,\.]", "", n_low).split()))

        candidates = [
            f"{n_sorted}|{c_low}",
            f"{n_low}|{c_low}",
            n_sorted,
            n_low
        ]

        for c in candidates:
            if c in headers and headers[c].get("url"):
                return headers[c]["url"]
            if c in featured_photos and featured_photos[c].get("url"):
                return featured_photos[c]["url"]
            if c in photos_db and len(photos_db[c]) > 0:
                p = photos_db[c][0]
                if p.get("server") and p.get("id") and p.get("secret"):
                    return f"https://live.staticflickr.com/{p['server']}/{p['id']}_{p['secret']}_b.jpg"
                if p.get("url"):
                    return p["url"]

        return "assets/images/hero_placeholder.jpg"

    # 3. Generate stubs
    generated_count = 0
    for key, data in runners.items():
        recs = data["records"]
        display_name = data["displayName"]
        
        # Primary club
        sorted_clubs = sorted(data["clubs"].items(), key=lambda x: x[1], reverse=True)
        primary_club = sorted_clubs[0][0] if sorted_clubs else "GLCL Competitor"

        # Latest category
        latest_cat = recs[0].get("age_cat") or "Competitor"

        total_races = len(recs)
        seasons = set(r.get("season") for r in recs if r.get("season"))
        total_seasons = len(seasons)

        # Photo resolution
        raw_photo = resolve_runner_photo(display_name, primary_club)
        if raw_photo.startswith("http"):
            photo_url = raw_photo
        else:
            photo_url = f"https://glcl.uk/{raw_photo.lstrip('/')}"

        # Summary description
        desc = f"{total_races} League Races • {total_seasons} Season{'s' if total_seasons > 1 else ''} • {primary_club} — View career milestones, race history and share card on the GLCL Archive."
        title = f"{display_name} — GLCL Career Story & Milestones"
        target_story_url = f"../story.html?name={display_name.replace(' ', '+')}&club={primary_club.replace(' ', '+')}"

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:site_name" content="GLCL Archive">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{desc}">
    <meta property="og:image" content="{photo_url}">
    <meta property="og:image:alt" content="{display_name} racing in GLCL">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{desc}">
    <meta name="twitter:image" content="{photo_url}">

    <!-- Immediate Client-Side Redirect -->
    <meta http-equiv="refresh" content="0; url={target_story_url}">
    <script>
        window.location.replace({json.dumps(target_story_url)});
    </script>
</head>
<body style="background:#0f172a; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; text-align:center; padding:20vh 20px 0;">
    <h1 style="font-size:1.5rem; margin-bottom:0.5rem;">{display_name} — GLCL Career Story</h1>
    <p style="color:#94a3b8; font-size:0.9rem;">{primary_club} • {total_races} League Races</p>
    <p style="margin-top:1.5rem;"><a href="{target_story_url}" style="color:#38bdf8; text-decoration:underline;">Click here if not redirected automatically</a></p>
</body>
</html>
"""

        name_slug = slugify(display_name)
        club_slug = slugify(primary_club)

        # Primary stub: /share/{name-slug}.html
        primary_file = SHARE_DIR / f"{name_slug}.html"
        with open(primary_file, "w", encoding="utf-8") as f:
            f.write(html_content)
        generated_count += 1

        # Also write /share/{name-slug}-{club-slug}.html for club disambiguation
        if club_slug:
            club_file = SHARE_DIR / f"{name_slug}-{club_slug}.html"
            if club_file != primary_file:
                with open(club_file, "w", encoding="utf-8") as f:
                    f.write(html_content)
                generated_count += 1

    print(f"Generated {generated_count} share stubs in {SHARE_DIR}")

if __name__ == "__main__":
    generate_stubs()

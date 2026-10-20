#!/usr/bin/env python3
"""
GLCL Single Album Auto-Indexer & Fixture Register
Accepts a Flickr album ID or URL, automatically registers it in fixture_photo_albums.json,
and indexes runners into photo_tags.json using Apple Vision Neural Engine.

Usage:
  # Index by Flickr album URL:
  python3 backend_tools/index_album.py https://www.flickr.com/photos/199341480@N07/albums/72177720330513551 --limit 200

  # Index by Album ID with specific season:
  python3 backend_tools/index_album.py 72177720330513551 --season 2025/2026 --limit 150
"""

import sys
import re
import json
import urllib.request
import argparse
from pathlib import Path

# Add backend_tools directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))
from scan_flickr_album import scan_album, FLICKR_API_KEY, extract_album_id

FIXTURE_ALBUMS_FILE = Path("assets/data/fixture_photo_albums.json")
PHOTO_TAGS_FILE = Path("assets/data/photo_tags.json")

def get_album_info(album_id):
    """Fetch photoset info from Flickr API."""
    url = (
        f"https://api.flickr.com/services/rest/?method=flickr.photosets.getInfo"
        f"&api_key={FLICKR_API_KEY}&photoset_id={album_id}&format=json&nojsoncallback=1"
    )
    try:
        req = urllib.request.urlopen(url)
        data = json.loads(req.read().decode('utf-8'))
        if data.get("stat") == "ok":
            return data.get("photoset", {})
    except Exception as e:
        print(f"Warning: Could not fetch Flickr album metadata: {e}")
    return {}

def infer_album_details(title):
    """Infer season, discipline, venue, and race number from album title."""
    title_lower = title.lower()
    
    # Discipline
    discipline = "road" if "road" in title_lower else "xc"
    
    # Season detection
    season = None
    m_season = re.search(r'(\b20\d{2}[/-]\d{2,4}\b|\b\d{2}/\d{2}\b)', title)
    if m_season:
        raw_s = m_season.group(1).replace('-', '/')
        if len(raw_s) == 5: # e.g. 25/26
            parts = raw_s.split('/')
            season = f"20{parts[0]}/20{parts[1]}"
        elif len(raw_s) == 7: # e.g. 2025/26
            parts = raw_s.split('/')
            season = f"{parts[0]}/20{parts[1]}"
        else:
            season = raw_s
    elif "2026" in title:
        season = "2025/2026" if discipline == "road" else "2026/2027"
    elif "2025" in title:
        season = "2024/2025" if discipline == "road" else "2025/2026"
    elif "2024" in title:
        season = "2023/2024" if discipline == "road" else "2024/2025"
    elif "2023" in title:
        season = "2022/2023" if discipline == "road" else "2023/2024"

    # Known Venues
    known_venues = [
        "Glebelands", "Rogerstone", "Monmouth", "Oldfield Farm",
        "Parc Bryn Bach", "Blaenavon", "Cwmbran", "Risca", "Pontypool",
        "Garway", "Newport", "Machen", "Pontllanfraith"
    ]
    venue = ""
    for v in known_venues:
        if v.lower() in title_lower:
            venue = v
            break

    # Race Number
    m_race = re.search(r'(?:race|fixture)\s*#?\s*(\d+)', title_lower)
    race_number = int(m_race.group(1)) if m_race else 1

    return {
        "discipline": discipline,
        "season": season or "2025/2026",
        "venue": venue or "GLCL Fixture",
        "race_number": race_number
    }

def register_album_if_needed(album_id, album_info, override_season=None):
    """Ensure album is recorded in assets/data/fixture_photo_albums.json."""
    if not FIXTURE_ALBUMS_FILE.exists():
        FIXTURE_ALBUMS_FILE.parent.mkdir(parents=True, exist_ok=True)
        fixtures = {}
    else:
        try:
            with open(FIXTURE_ALBUMS_FILE, "r") as f:
                fixtures = json.load(f)
        except Exception:
            fixtures = {}

    title = album_info.get("title", {}).get("_content", f"GLCL Race Album {album_id}")
    photos_count = int(album_info.get("photos", 0))
    date_str = album_info.get("date_create", "")

    inferred = infer_album_details(title)
    final_season = override_season or inferred["season"]

    entry = {
        "album_id": album_id,
        "title": title,
        "photos": photos_count,
        "season": final_season,
        "discipline": inferred["discipline"],
        "race_number": inferred["race_number"],
        "venue": inferred["venue"],
        "date": date_str
    }

    # Store under album_id as primary key
    fixtures[album_id] = entry

    # Also store under fixture key if not already defined
    fixture_key = f"{final_season.replace('/', '_')}_{inferred['discipline']}_{inferred['race_number']}"
    if fixture_key not in fixtures:
        fixtures[fixture_key] = entry

    with open(FIXTURE_ALBUMS_FILE, "w") as f:
        json.dump(fixtures, f, indent=2)

    return entry

def main():
    parser = argparse.ArgumentParser(description="Index single GLCL Flickr album and register in archive")
    parser.add_argument("target", help="Flickr Album URL or ID (e.g. 72177720330513551)")
    parser.add_argument("--season", help="Override season (e.g. 2025/2026)")
    parser.add_argument("--limit", type=int, default=200, help="Max photos to analyze (default: 200)")
    args = parser.parse_args()

    album_id = extract_album_id(args.target)
    if not album_id or not album_id.isdigit():
        print(f"Error: Invalid album ID or URL '{args.target}'")
        sys.exit(1)

    print(f"Fetching metadata for album {album_id} from Flickr...")
    info = get_album_info(album_id)
    album_meta = register_album_if_needed(album_id, info, override_season=args.season)

    print(f"\n📋 Registered Album Metadata:")
    print(f"  Title:       {album_meta['title']}")
    print(f"  Season:      {album_meta['season']}")
    print(f"  Discipline:  {album_meta['discipline'].upper()}")
    print(f"  Venue:       {album_meta['venue']}")
    print(f"  Total Size:  {album_meta['photos']} photos on Flickr\n")

    # Run scanning & tagging
    tagged, total_index = scan_album(album_id, season=album_meta['season'], limit=args.limit)

    print(f"✨ Successfully indexed {tagged} photos for {album_meta['title']}.")
    print(f"Athletes from this album are now searchable on glcl.uk/photos.html and results.html.")

if __name__ == "__main__":
    main()

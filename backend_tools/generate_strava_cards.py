#!/usr/bin/env python3
"""
GLCL Archive — Strava-Style Share Card Generator
Generates high-resolution 1200x630 composite social cards for athletes:
full-bleed action photo with crisp Strava-style athletic stats overlaid directly on top.
"""

import os
import sys
import json
import re
import io
import urllib.request
import ssl
import certifi
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_JS_PATH = BASE_DIR / "data.js"
FEATURED_PHOTOS_PATH = BASE_DIR / "assets" / "data" / "athlete_featured_photos.json"
ATHLETE_HEADERS_PATH = BASE_DIR / "assets" / "data" / "athlete_headers.json"
ATHLETE_PHOTOS_PATH = BASE_DIR / "assets" / "data" / "athlete_photos.json"
CLUB_COLOURS_PATH = BASE_DIR / "assets" / "data" / "club_colours.json"
CARDS_DIR = BASE_DIR / "assets" / "cards"

def get_ordinal(n):
    if not n or n >= 999:
        return ""
    n = int(n)
    s = ["th", "st", "nd", "rd"]
    v = n % 100
    if 11 <= v <= 13:
        return "th"
    return s[v % 10] if (v % 10) < len(s) else "th"

def slugify(text):
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def get_name_key(text):
    if not text:
        return ""
    words = re.sub(r"[,\.]", "", text.lower()).split()
    return " ".join(sorted(words))

def hex_to_rgb(hex_str, default=(2, 132, 199)):
    if not hex_str:
        return default
    hex_str = hex_str.lstrip("#")
    try:
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    except Exception:
        return default

def get_system_font(name_bold=True, size=24):
    paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if name_bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf"
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def render_strava_card(runner_data, photo_url, club_color_rgb=(2, 132, 199), output_path=None):
    target_w, target_h = 1200, 630

    # 1. Fetch & scale background photo
    src_img = None
    try:
        if photo_url.startswith("http"):
            ssl_ctx = ssl.create_default_context(cafile=certifi.where())
            req = urllib.request.Request(photo_url, headers={"User-Agent": "Mozilla/5.0 GLCL/1.0"})
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
                src_img = Image.open(io.BytesIO(resp.read())).convert("RGB")
        elif os.path.exists(BASE_DIR / photo_url.lstrip("/")):
            src_img = Image.open(BASE_DIR / photo_url.lstrip("/")).convert("RGB")
    except Exception as e:
        print(f"    [Image fetch warning for {runner_data['displayName']}]: {e}", file=sys.stderr)

    if not src_img:
        placeholder = BASE_DIR / "assets" / "images" / "hero_placeholder.jpg"
        if placeholder.exists():
            src_img = Image.open(placeholder).convert("RGB")
        else:
            src_img = Image.new("RGB", (target_w, target_h), (15, 23, 42))

    # Scale & cover crop
    src_w, src_h = src_img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w = int(src_w * scale)
    new_h = int(src_h * scale)
    resized = src_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    left = (new_w - target_w) // 2
    top = int((new_h - target_h) * 0.15) # bias toward face / upper body
    card = resized.crop((left, top, left + target_w, top + target_h)).convert("RGBA")

    # 2. Draw Strava-style gradients
    overlay = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    draw_ov = ImageDraw.Draw(overlay)

    # Top gradient for header branding
    for y in range(150):
        alpha = int(200 * (1 - y / 150))
        draw_ov.line([(0, y), (target_w, y)], fill=(3, 7, 18, alpha))

    # Bottom gradient for stats block
    for y in range(210, target_h):
        factor = (y - 210) / (target_h - 210)
        alpha = int(245 * (factor ** 1.35))
        draw_ov.line([(0, y), (target_w, y)], fill=(3, 7, 18, alpha))

    card = Image.alpha_composite(card, overlay)
    draw = ImageDraw.Draw(card)

    # 3. Fonts
    font_name = get_system_font(name_bold=True, size=50)
    font_brand = get_system_font(name_bold=True, size=24)
    font_brand_sub = get_system_font(name_bold=False, size=15)
    font_pill = get_system_font(name_bold=True, size=13)
    font_stat_val = get_system_font(name_bold=True, size=42)
    font_stat_lbl = get_system_font(name_bold=True, size=13)
    font_sub = get_system_font(name_bold=False, size=17)

    # Top accent line in club color
    draw.rectangle([(0, 0), (target_w, 8)], fill=club_color_rgb)

    # Top Branding: GLCL Archive
    draw.text((50, 42), "GLCL ARCHIVE", font=font_brand, fill=(255, 255, 255))
    draw.text((50, 72), "GWENT LEISURE CENTRE LEAGUE", font=font_brand_sub, fill=(56, 189, 248))

    # Top Right Season Pill (Exact centering with anchor="mm")
    total_seasons = runner_data.get("totalSeasons", 1)
    season_text = f"{total_seasons} SEASONS STRONG"
    pill_rx1, pill_ry1, pill_rx2, pill_ry2 = target_w - 270, 42, target_w - 50, 80
    draw.rounded_rectangle([(pill_rx1, pill_ry1), (pill_rx2, pill_ry2)], radius=8, fill=(15, 23, 42, 210), outline=(56, 189, 248, 140), width=1)
    draw.text(((pill_rx1 + pill_rx2) / 2, (pill_ry1 + pill_ry2) / 2), season_text, font=font_pill, fill=(241, 245, 249), anchor="mm")

    # Bottom Overlay: Club Pill (Exact centering with anchor="mm")
    primary_club = runner_data.get("primaryClub", "GLCL COMPETITOR").upper()
    pill_w = min(420, int(len(primary_club) * 9.5) + 32)
    c_x1, c_y1, c_x2, c_y2 = 50, 335, 50 + pill_w, 367
    draw.rounded_rectangle([(c_x1, c_y1), (c_x2, c_y2)], radius=6, fill=club_color_rgb)
    draw.text(((c_x1 + c_x2) / 2, (c_y1 + c_y2) / 2), primary_club, font=font_pill, fill=(255, 255, 255), anchor="mm")

    # Runner Name (Bold White with shadow)
    display_name = runner_data.get("displayName", "ATHLETE").upper()
    if len(display_name) > 22:
        display_name = display_name[:21] + "…"
    # Subtle drop shadow for name
    draw.text((52, 382), display_name, font=font_name, fill=(0, 0, 0, 180))
    draw.text((50, 380), display_name, font=font_name, fill=(255, 255, 255))

    # Subtitle line: Category + Years competing + Miles
    primary_cat = runner_data.get("primaryCat", "COMPETITOR").upper()
    years_text = runner_data.get("yearsSpanText", "")
    miles = runner_data.get("miles", 0)
    sub_parts = [f"{primary_cat} DIVISION"]
    if years_text:
        sub_parts.append(years_text)
    sub_parts.append(f"~{miles} LEAGUE MILES")
    sub_line = " • ".join(sub_parts)
    draw.text((52, 442), sub_line, font=font_sub, fill=(148, 163, 184))

    # 5 Strava Stat Capsules
    total_races = runner_data.get("totalRaces", 0)
    cat_wins = runner_data.get("catWins", 0)
    podiums = runner_data.get("podiums", 0)
    best_xc = runner_data.get("bestXc")
    best_road = runner_data.get("bestRoad")
    venues_count = runner_data.get("uniqueVenues", 0)

    # Pick most impressive stats
    stat_3_val = str(cat_wins) if cat_wins > 0 else str(podiums)
    stat_3_lbl = "CAT WINS" if cat_wins > 0 else "PODIUMS"

    if best_xc and best_xc < 999:
        stat_4_val = f"{best_xc}{get_ordinal(best_xc)}"
        stat_4_lbl = "BEST XC"
    elif best_road and best_road < 999:
        stat_4_val = f"{best_road}{get_ordinal(best_road)}"
        stat_4_lbl = "BEST ROAD"
    else:
        stat_4_val = f"~{miles}"
        stat_4_lbl = "MILES"

    stats = [
        (str(total_races), "RACES"),
        (str(total_seasons), "SEASONS"),
        (stat_3_val, stat_3_lbl),
        (stat_4_val, stat_4_lbl),
        (str(venues_count), "VENUES")
    ]

    stat_box_w = 208
    stat_box_h = 92
    gap = 15
    start_x = 50
    start_y = 485

    for i, (val, lbl) in enumerate(stats):
        bx = start_x + i * (stat_box_w + gap)
        by = start_y
        draw.rounded_rectangle([(bx, by), (bx + stat_box_w, by + stat_box_h)], radius=12, fill=(15, 23, 42, 220), outline=(71, 85, 105, 170), width=1)
        draw.text((bx + stat_box_w / 2, by + 32), val, font=font_stat_val, fill=(255, 255, 255), anchor="mm")
        draw.text((bx + stat_box_w / 2, by + 68), lbl, font=font_stat_lbl, fill=(56, 189, 248), anchor="mm")

    final_rgb = card.convert("RGB")
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final_rgb.save(output_path, "JPEG", quality=92)
    return final_rgb

def generate_all_cards(limit=None, runner_filter=None):
    CARDS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading datasets...")
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    json_str = content.split("window.glclResults =")[1].strip().rstrip(";")
    records = json.loads(json_str)

    club_colours = {}
    if CLUB_COLOURS_PATH.exists():
        with open(CLUB_COLOURS_PATH, "r", encoding="utf-8") as f:
            club_colours = json.load(f).get("clubs", {})

    headers = {}
    if ATHLETE_HEADERS_PATH.exists():
        with open(ATHLETE_HEADERS_PATH, "r", encoding="utf-8") as f:
            headers = json.load(f)

    featured_photos = {}
    if FEATURED_PHOTOS_PATH.exists():
        with open(FEATURED_PHOTOS_PATH, "r", encoding="utf-8") as f:
            featured_photos = json.load(f)

    # Group runner stats
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

    # Filter runners
    runner_keys = list(runners.keys())
    if runner_filter:
        runner_keys = [k for k in runner_keys if runner_filter.lower() in runners[k]["displayName"].lower()]

    print(f"Processing cards for {len(runner_keys)} runners...")

    count = 0
    for key in runner_keys:
        data = runners[key]
        display_name = data["displayName"]
        recs = data["records"]

        sorted_clubs = sorted(data["clubs"].items(), key=lambda x: x[1], reverse=True)
        primary_club = sorted_clubs[0][0] if sorted_clubs else "GLCL Competitor"

        # Find photo
        n_low = display_name.lower().strip()
        c_low = primary_club.lower().strip()
        n_sorted = " ".join(sorted(re.sub(r"[,\.]", "", n_low).split()))

        candidates = [
            f"{n_sorted}|{c_low}",
            f"{n_low}|{c_low}",
            n_sorted,
            n_low
        ]

        photo_url = None
        for c in candidates:
            if c in headers and headers[c].get("url"):
                photo_url = headers[c]["url"]
                break
            if c in featured_photos and featured_photos[c].get("url"):
                photo_url = featured_photos[c]["url"]
                break

        # Only generate custom cards for runners who have a photo or if specific runner filtered
        if not photo_url and not runner_filter:
            continue

        if not photo_url:
            photo_url = "assets/images/hero_placeholder.jpg"

        # Club color
        club_rgb = (2, 132, 199)
        for cName, cObj in club_colours.items():
            if cName.lower() == primary_club.lower() or any(a.lower() == primary_club.lower() for a in cObj.get("aliases", [])):
                hex_c = cObj.get("primary_color", {}).get("hex")
                if hex_c:
                    club_rgb = hex_to_rgb(hex_c)
                break

        # Compute stats
        total_races = len(recs)
        sorted_seasons = sorted(set(r.get("season") for r in recs if r.get("season")))
        total_seasons = len(sorted_seasons)
        cat_wins = sum(1 for r in recs if int(r.get("cat_pos", 999) or 999) == 1)
        podiums = sum(1 for r in recs if int(r.get("cat_pos", 999) or 999) <= 3)
        total_miles = sum(4.8 if "xc" in (r.get("discipline") or "").lower() else 5.2 for r in recs)

        xc_recs = [r for r in recs if "xc" in (r.get("discipline") or "").lower()]
        road_recs = [r for r in recs if "road" in (r.get("discipline") or "").lower()]
        best_xc = min([int(r.get("pos", 999) or 999) for r in xc_recs] or [999])
        best_road = min([int(r.get("pos", 999) or 999) for r in road_recs] or [999])
        venues = set(r.get("venue") for r in recs if r.get("venue"))

        years_text = ""
        if len(sorted_seasons) > 0:
            try:
                first_y = int(sorted_seasons[0].split("/")[0])
                last_s = sorted_seasons[-1].split("/")
                last_y = int(last_s[1] if len(last_s) > 1 else last_s[0])
                span_yrs = (last_y - first_y) + 1
                years_text = f"{first_y} – {last_y} ({span_yrs} YEARS ACTIVE)"
            except Exception:
                years_text = f"{sorted_seasons[0]} – {sorted_seasons[-1]}"

        runner_payload = {
            "displayName": display_name,
            "primaryClub": primary_club,
            "primaryCat": recs[0].get("age_cat") or "Competitor",
            "totalRaces": total_races,
            "totalSeasons": total_seasons,
            "catWins": cat_wins,
            "podiums": podiums,
            "bestXc": best_xc,
            "bestRoad": best_road,
            "uniqueVenues": len(venues),
            "yearsSpanText": years_text,
            "miles": round(total_miles)
        }

        name_slug = slugify(display_name)
        out_path = CARDS_DIR / f"{name_slug}.jpg"
        print(f"Generating Strava card for {display_name} -> {out_path.name}")
        render_strava_card(runner_payload, photo_url, club_color_rgb=club_rgb, output_path=out_path)
        count += 1

        if limit and count >= limit:
            break

    print(f"Done! Generated {count} custom Strava share cards in {CARDS_DIR}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--runner", type=str, default=None)
    args = parser.parse_args()
    generate_all_cards(limit=args.limit, runner_filter=args.runner)

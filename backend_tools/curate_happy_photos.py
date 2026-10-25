#!/usr/bin/env python3
"""
GLCL Archive — AI Photo Curator
Identifies the best quality, smiling, happy, and clear race photo for each athlete
for use in the Career Story page and Social Share Cards.

Supports:
  1. Multimodal Gemini Vision scoring (expression, smile, clarity, framing) if GEMINI_API_KEY is available.
  2. Smart optical sharpness and quality heuristic ranking as offline/default baseline.
  3. Outputs to assets/data/athlete_featured_photos.json.
"""

import os
import sys
import json
import argparse
import urllib.request
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
ATHLETE_PHOTOS_PATH = BASE_DIR / "assets" / "data" / "athlete_photos.json"
OUTPUT_PATH = BASE_DIR / "assets" / "data" / "athlete_featured_photos.json"

def get_flickr_photo_url(photo_obj, size="b"):
    """Generate Flickr static photo URL from photo dictionary."""
    if "url" in photo_obj and photo_obj["url"]:
        return photo_obj["url"]
    server = photo_obj.get("server")
    pid = photo_obj.get("id")
    secret = photo_obj.get("secret")
    if server and pid and secret:
        return f"https://live.staticflickr.com/{server}/{pid}_{secret}_{size}.jpg"
    return None

def score_photo_with_gemini(photo_url, athlete_name, api_key):
    """
    Score photo with Gemini Vision for smile, facial expression, and clarity.
    Returns dict with scores and reasoning.
    """
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        import ssl
        import certifi
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        
        # Download image into memory (or pass direct URL)
        req = urllib.request.Request(photo_url, headers={"User-Agent": "Mozilla/5.0 GLCL-Archive/1.0"})
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
            image_bytes = resp.read()

        prompt = f"""
        You are an expert race photographer curator for the Gwent Leisure Centre League.
        Evaluate this running race photo for runner '{athlete_name}'.
        We are selecting the best feature photo for their Career Story & Social Share Card.
        Ideal criteria:
        1. Smiling / Happy / Joyous expression (smiling, thumbs up, celebrating, high energy) vs painful/straining grimace.
        2. Clarity & Face Focus (unobscured face, sharp focus on runner, not blocked by another runner).
        3. Good portrait / upper torso framing suitable for a profile showcase card.

        Output strictly valid JSON with this schema:
        {{
            "is_smiling": true/false,
            "smile_score": 0-100,
            "clarity_score": 0-100,
            "framing_score": 0-100,
            "overall_score": 0-100,
            "tagline": "Brief 3-6 word description e.g. 'Bright smile crossing the line'"
        }}
        """

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                prompt
            ]
        )

        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        return json.loads(text)
    except Exception as e:
        print(f"    [Gemini scoring warning]: {e}", file=sys.stderr)
        return None

def curate_photos(limit=None, runner_filter=None, use_gemini=False, gemini_api_key=None):
    if not ATHLETE_PHOTOS_PATH.exists():
        print(f"Error: {ATHLETE_PHOTOS_PATH} not found.")
        return

    with open(ATHLETE_PHOTOS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Load existing featured photos to preserve manual / previous scores
    featured = {}
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
                featured = json.load(f)
        except Exception:
            featured = {}

    runners = list(data.keys())
    if runner_filter:
        runners = [r for r in runners if runner_filter.lower() in r.lower()]

    if limit:
        runners = runners[:limit]

    print(f"Curating featured photos for {len(runners)} athletes...")

    processed_count = 0
    for runner_name in runners:
        photos = data[runner_name]
        if not isinstance(photos, list) or len(photos) == 0:
            continue

        # Sort candidate photos by sharpness descending
        valid_photos = []
        for p in photos:
            url = get_flickr_photo_url(p, size="b")
            if url:
                valid_photos.append({
                    **p,
                    "full_url": url,
                    "sharpness": float(p.get("sharpness", 0) or 0)
                })

        if not valid_photos:
            continue

        valid_photos.sort(key=lambda x: x["sharpness"], reverse=True)
        top_candidates = valid_photos[:min(5, len(valid_photos))]

        best_photo = top_candidates[0]
        curation_meta = {
            "source": "sharpness_heuristic",
            "sharpness": best_photo["sharpness"]
        }

        # If Gemini AI scoring enabled
        if use_gemini and gemini_api_key:
            print(f"  AI evaluating top {len(top_candidates)} photos for {runner_name}...")
            highest_score = -1
            for cand in top_candidates:
                ai_res = score_photo_with_gemini(cand["full_url"], runner_name, gemini_api_key)
                if ai_res and ai_res.get("overall_score", 0) > highest_score:
                    highest_score = ai_res.get("overall_score", 0)
                    best_photo = cand
                    curation_meta = {
                        "source": "gemini_vision",
                        "ai_scores": ai_res
                    }

        featured[runner_name] = {
            "photoId": best_photo.get("id"),
            "url": best_photo["full_url"],
            "bib": best_photo.get("bib", ""),
            "club": best_photo.get("club", ""),
            "curation": curation_meta,
            "updatedAt": "2026-10-25T14:20:00Z"
        }

        processed_count += 1
        if processed_count % 50 == 0:
            print(f"  Processed {processed_count}/{len(runners)} athletes...")

    # Save output
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(featured, f, indent=2)

    print(f"Successfully saved {len(featured)} featured athlete photos to {OUTPUT_PATH}")

def main():
    parser = argparse.ArgumentParser(description="Curate top smiling / clear photos for athletes.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of athletes to process")
    parser.add_argument("--runner", type=str, default=None, help="Process specific runner name")
    parser.add_argument("--gemini", action="store_true", help="Use Gemini Vision API for smiling/expression evaluation")
    parser.add_argument("--api-key", type=str, default=None, help="Gemini API Key")

    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        config_path = BASE_DIR / "backend_tools" / "config.json"
        if config_path.exists():
            try:
                with open(config_path, "r", encoding="utf-8") as cf:
                    cdata = json.load(cf)
                    api_key = cdata.get("GEMINI_API_KEY")
            except Exception:
                pass

    use_gemini = args.gemini or bool(api_key)

    curate_photos(
        limit=args.limit,
        runner_filter=args.runner,
        use_gemini=use_gemini,
        gemini_api_key=api_key
    )

if __name__ == "__main__":
    main()

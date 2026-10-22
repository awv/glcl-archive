# GLCL Archive — Project Guidelines & Workflow Memory

This repository contains the historical database, analytics platform, and photo gallery for the **Gwent Leisure Centre League (GLCL)** (1986–Present), deployed via GitHub Pages to [glcl.uk](https://glcl.uk).

---

## ⚡ Fast Results Import & Publish Workflow (2-Minute Runbook)

Whenever new official race results arrive:

1. **Drop the PDF**:
   Place the official results PDF into `backend_tools/2026_Results/pdf_source/`
   *(e.g. `GLCL_2026_2027_XC_2.pdf` or `GLCL_2026_2027_ROAD_1.pdf`)*.

2. **Parse PDF to Text**:
   ```bash
   python backend_tools/2026_Results/parse_results.py
   ```
   * Automatically detects discipline (`xc` vs `road`), season (e.g. `2026_2027`), and race number from the filename.
   * Extracts times, positions, age categories, and clubs.
   * Preserves confirmed course distance, venue, and date headers if already present in `backend_tools/results_source/`.
   * Outputs matching file into `backend_tools/results_source/` (e.g. `xc_2026_2027_2.txt`).

3. **Rebuild Master Dataset**:
   ```bash
   node backend_tools/parse_fixtures.js
   ```
   * Recompiles all historical fixtures across all seasons into `data.js` (`window.glclResults`).
   * Normalises club aliases and recalculates category/gender positions.

4. **Activate Fixture Link on Home Page**:
   In `index.html`, find `ARCHIVE_CONFIG.fixtures` and flip the corresponding fixture:
   ```javascript
   live: true
   ```
   *(This enables the clickable "View Results" button on the home page fixture card)*.

5. **Commit & Push to Publish**:
   ```bash
   git add .
   git commit -m "Add 2026/2027 XC Race 2 results"
   git push origin main
   ```
   GitHub Pages will automatically build and deploy the update live to `glcl.uk`.

---

## 🏗️ Architecture & Key Files

* **`data.js`**: Master JSON dataset (`window.glclResults`), ~45,000+ finishes across 20+ seasons.
* **`index.html`**: Homepage with active season fixture board (`ARCHIVE_CONFIG`), database stats, and autocomplete athlete search.
* **`backend_tools/2026_Results/parse_results.py`**: Python PDF parser utilizing `pdfplumber`.
* **`backend_tools/parse_fixtures.js`**: Master compiler node script. Contains canonical `clubAliases` dictionary.
* **`backend_tools/results_source/`**: Repository of plain-text race results with `# VENUE:`, `# DATE:`, `# DISTANCE:`, and `# STATUS:` headers.
* **`assets/js/corrections.js`**: Client-side mapping for athlete name changes/marriages (`nameChanges`), runner club transfer timelines (`clubHistory`), and canonical club name aliases (`clubAliases`).
* **`assets/js/stats-engine.js`**: Dynamic calculator for season podiums, dominators, and club turnout tables.
* **`assets/js/athlete-insights.js`**: Generates runner sparklines, form progression, and recurring venue comparisons.
* **`site-layout.js`**: Dynamic header/footer injector and command palette search bar.

---

## 🔍 Data Quality & Normalisation Rules

* **Athlete Names**: Standardised format is `Forename SURNAME` (e.g. `Joby EYNON`, `Huw EVANS`).
* **Name Changes / Merges**: Add married/changed names to `window.glclCorrections.nameChanges` in `assets/js/corrections.js` so past and present results merge under one career profile.
* **Club Aliases**: Any new spelling variations or shorthand names must be registered in both `clubAliases` in `backend_tools/parse_fixtures.js` and `assets/js/corrections.js`.

---

## 📸 Historical & Unbibbed Photography Protocol

For historical races (e.g. 2017/2018 XC) where bib numbers were not worn or were obscured:

1. **Strict Zero-False-Data Standard**:
   - **Never** infer runner identity solely from pack order / finish position early in the race (runners swap positions constantly during laps).
   - Tagging requires:
     - Direct, high-confidence facial match against verified anchor photos.
     - Physical markers (distinctive tattoos, named shirts e.g. "OLLIE", "JON").
     - Immediate multi-shot burst continuity (within 1–3s of a verified runner).
   - If there is any ambiguity, the photo must remain **unassigned** (`runners: []`).

2. **Per-Album Index Build**:
   - Whenever photo tags are updated, run:
     ```bash
     python3 backend_tools/reconcile_photo_tags.py --apply
     ```
   - This writes lightweight per-album files to `assets/data/albums/<album_id>.json` and synchronises `assets/data/athlete_photos.json`.

3. **Photo Viewer UX**:
   - `athlete.html` displays race photos directly within native lightboxes with zero external links to Flickr.
   - Bulk high-resolution ZIP downloading is strictly reserved for individual athletes on their own profile page (`athlete.html`).


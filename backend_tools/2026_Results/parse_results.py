import pdfplumber
import re
import os
import glob

# Paths
base_dir = os.path.dirname(__file__)
pdf_dir = os.path.join(base_dir, "pdf_source")
output_dir = os.path.join(base_dir, "results_source")

LINE_REGEX = re.compile(r'^(\d+)\s+(.+)$')
METRICS_REGEX = re.compile(r'\s+\*?([MF])\*?\s+(\d+)\s+\*?([A-Z0-9]+)\*?\s+(\d+)\s+(\d+:\d+:\d+)\s*$')

# Create directories if they don't exist
os.makedirs(pdf_dir, exist_ok=True)
os.makedirs(output_dir, exist_ok=True)

# Find all PDFs in the source folder
pdf_files = glob.glob(os.path.join(pdf_dir, "*.pdf"))

if not pdf_files:
    print(f"No PDFs found in {pdf_dir}. Please drop your race PDFs there.")
    print("Example filename format: road_2025_2026_1.pdf")

for pdf_path in pdf_files:
    filename = os.path.basename(pdf_path)
    print(f"\nProcessing {filename}...")
    
    # Force the output filename format to match what parse_fixtures.js expects: road_2025_2026_X.txt
    # We can extract the race number dynamically from the end of the filename
    race_num_match = re.search(r'(\d+)\.pdf$', filename, re.IGNORECASE)
    race_number = race_num_match.group(1) if race_num_match else "1"
    
    txt_filename = f"road_2025_2026_{race_number}.txt"
    output_txt_path = os.path.join(output_dir, txt_filename)

    # Default metadata fallbacks
    venue = "Unknown Venue"
    date = "Unknown Date"
    distance = "5 Miles" # Default road distance fallback
    
    parsed_lines = []

    with pdfplumber.open(pdf_path) as pdf:
        # 1. Grab metadata from the first page header text before parsing rows
        first_page_text = pdf.pages[0].extract_text() or ""
        for line in first_page_text.split("\n"):
            # Looks for common header patterns like "Venue: Caerleon" or "Date: 05/05/2026"
            if "VENUE:" in line.upper():
                venue = line.split(":")[-1].strip()
            if "DATE:" in line.upper():
                date = line.split(":")[-1].strip()
            if "DISTANCE:" in line.upper():
                distance = line.split(":")[-1].strip()

        # Add the required build tool headers
        parsed_lines.extend([
            f"# VENUE: {venue}",
            f"# DATE: {date}",
            f"# DISTANCE: {distance}",
            "# STATUS: Confirmed"
        ])

        # 2. Parse the table rows across all pages
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            for line in text.split('\n'):
                line_str = line.strip()
                
                start_match = LINE_REGEX.match(line_str)
                if not start_match:
                    continue
                    
                pos = int(start_match.group(1))
                raw_content = start_match.group(2).strip()
                
                metrics_match = METRICS_REGEX.search(raw_content)
                if not metrics_match:
                    # Print out skipped rows so we can instantly see the formatting quirks
                    print(f"Skipped row: {line_str}")
                    continue
                    
                sex = metrics_match.group(1)
                gender_pos = int(metrics_match.group(2))
                age_cat = metrics_match.group(3)
                cat_pos = int(metrics_match.group(4))
                time = metrics_match.group(5)
                
                # Auto-convert specific 16S categories to Senior
                if age_cat.upper() in ["M16S", "F16S", "SENIOR"]:
                    age_cat = "Senior"
                elif age_cat[0].upper() in ["M", "F"] and age_cat[1:].isdigit():
                    # Automatically turns "M35" into "V35" and "F45" into "V45" 
                    # so that parse_fixtures.js can read them perfectly!
                    age_cat = f"V{age_cat[1:]}"  
                    
                core_text = raw_content[:metrics_match.start()].strip()
                core_parts = core_text.split()
                if not core_parts:
                    continue
                    
                bib = "0"
                name_club_block = " ".join(core_parts[1:])
                
                words = name_club_block.split()
                surname_idx = -1
                for i in range(len(words) - 1, -1, -1):
                    if words[i].isupper() and re.match(r'^[A-Z\-\']+$', words[i]):
                        surname_idx = i
                        break
                
                if surname_idx != -1:
                    full_name = " ".join(words[:surname_idx + 1])
                    club = " ".join(words[surname_idx + 1:])
                else:
                    full_name = name_club_block
                    club = "Unknown"
                    
                if not club:
                    club = "Independent"

                if len(time.split(':')[0]) == 1:
                    time = f"0{time}"

                age_placeholder = 0 

                data_line = f"{pos} {bib} {full_name} {age_placeholder} {sex} {age_cat} {club} {time} {gender_pos} {cat_pos}"
                parsed_lines.append(data_line)

    # Save the individual text file out for this specific race
    with open(output_txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(parsed_lines) + "\n")

    print(f"Success! Generated '{txt_filename}' tracking {len(parsed_lines) - 4} finishers at {venue}.")
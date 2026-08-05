import pdfplumber
import re
import os
import glob

# Paths
base_dir = os.path.dirname(__file__)
pdf_dir = os.path.join(base_dir, "pdf_source")
output_dir = os.path.join(base_dir, "..", "results_source")

os.makedirs(pdf_dir, exist_ok=True)
os.makedirs(output_dir, exist_ok=True)

pdf_files = glob.glob(os.path.join(pdf_dir, "*.pdf"))

if not pdf_files:
    print(f"No PDFs found in {pdf_dir}. Please drop your race PDFs there.")

def find_time_token(tokens):
    for idx in range(len(tokens) - 1, -1, -1):
        if re.match(r'^\d{1,2}:\d{1,2}(?::\d{1,2})?$', tokens[idx]):
            return idx, tokens[idx]
    return -1, None

def format_time(t_str):
    parts = t_str.split(':')
    if len(parts) == 2:
        return f"00:{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    elif len(parts) == 3:
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:{parts[2].zfill(2)}"
    return t_str

for pdf_path in pdf_files:
    filename = os.path.basename(pdf_path)
    print(f"\nProcessing {filename}...")
    
    # Extract race number dynamically (e.g., GLCL_2026_ROAD_RACE_1.pdf -> 1)
    race_num_match = re.search(r'(\d+)\.pdf$', filename, re.IGNORECASE)
    race_number = race_num_match.group(1) if race_num_match else "1"
    
    txt_filename = f"road_2025_2026_{race_number}.txt"
    output_txt_path = os.path.join(output_dir, txt_filename)

    # Generic fallbacks reset for each file
    venue = f"Fixture {race_number}"
    date = "Unknown Date"
    distance = "5 Miles"
    
    parsed_lines = []

    with pdfplumber.open(pdf_path) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""
        for line in first_page_text.split("\n"):
            clean_line = line.strip()
            if "VENUE" in clean_line.upper():
                venue = clean_line.split(":")[-1].strip() if ":" in clean_line else clean_line
            if "DATE" in clean_line.upper():
                date = clean_line.split(":")[-1].strip() if ":" in clean_line else clean_line
            if "DISTANCE" in clean_line.upper():
                distance = clean_line.split(":")[-1].strip() if ":" in clean_line else clean_line

        parsed_lines.extend([
            f"# VENUE: {venue}",
            f"# DATE: {date}",
            f"# DISTANCE: {distance}",
            "# STATUS: Confirmed"
        ])

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            for line in text.split('\n'):
                line_str = line.strip()
                raw_tokens = line_str.split()

                if not raw_tokens or not raw_tokens[0].isdigit():
                    continue

                pos = int(raw_tokens[0])
                tokens = [t.strip('*') for t in raw_tokens[1:] if t.strip('*')]

                time_idx, raw_time = find_time_token(tokens)
                if time_idx == -1:
                    continue

                time = format_time(raw_time)
                row_tokens = tokens[:time_idx]

                sex_idx = -1
                for idx in range(len(row_tokens) - 1, -1, -1):
                    if row_tokens[idx].upper() in ['M', 'F']:
                        sex_idx = idx
                        break

                if sex_idx == -1:
                    continue

                sex = row_tokens[sex_idx].upper()
                
                age_cat = "Senior"
                if sex_idx > 0 and re.match(r'^(?:[MF]\d+|[MF]16S|SENIOR|SEN)$', row_tokens[sex_idx - 1].upper()):
                    age_cat = row_tokens[sex_idx - 1]
                    name_club_tokens = row_tokens[:sex_idx - 1]
                elif sex_idx + 1 < len(row_tokens) and re.match(r'^(?:[MF]\d+|[MF]16S|SENIOR|SEN)$', row_tokens[sex_idx + 1].upper()):
                    age_cat = row_tokens[sex_idx + 1]
                    name_club_tokens = row_tokens[:sex_idx]
                else:
                    name_club_tokens = row_tokens[:sex_idx]

                gender_pos = 0
                cat_pos = 0
                trailing_nums = [t for t in row_tokens[sex_idx + 1:] if t.isdigit() and not re.match(r'^(?:[MF]\d+|[MF]16S)$', t.upper())]
                if len(trailing_nums) >= 1:
                    gender_pos = int(trailing_nums[0])
                if len(trailing_nums) >= 2:
                    cat_pos = int(trailing_nums[1])

                if age_cat.upper() in ["M16S", "F16S", "SENIOR", "SEN", "M", "F"]:
                    age_cat = "Senior"
                elif age_cat[0].upper() in ["M", "F"] and age_cat[1:].isdigit():
                    age_cat = f"V{age_cat[1:]}"

                if name_club_tokens and re.match(r'^[A-Za-z]?\d+$', name_club_tokens[0]):
                    name_club_tokens = name_club_tokens[1:]

                if not name_club_tokens:
                    continue

                surname_idx = -1
                for i in range(len(name_club_tokens) - 1, -1, -1):
                    word = name_club_tokens[i]
                    is_caps = re.match(r'^[A-Z\-\']+$', word) is not None
                    is_mc = re.match(r'^(?:Mc|Mac)[A-Z][A-Z\-\']*$', word) is not None
                    if is_caps or is_mc:
                        surname_idx = i
                        break

                if surname_idx != -1:
                    full_name = " ".join(name_club_tokens[:surname_idx + 1])
                    club = " ".join(name_club_tokens[surname_idx + 1:])
                else:
                    full_name = " ".join(name_club_tokens)
                    club = "Independent"

                if not club:
                    club = "Independent"

                bib = "0"
                age_placeholder = 0

                data_line = f"{pos} {bib} {full_name} {age_placeholder} {sex} {age_cat} {club} {time} {gender_pos} {cat_pos}"
                parsed_lines.append(data_line)

    with open(output_txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(parsed_lines) + "\n")

    print(f"Success! Generated '{txt_filename}' tracking {len(parsed_lines) - 4} finishers.")
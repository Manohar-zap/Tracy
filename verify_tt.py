import pdfplumber
import json
import re
import os

pdf_path = 'PSAIAC_Sections_TT_Odd_Semester_31-07-2026.pdf'
json_dir = 'timetable'
report_path = 'verification_report.txt'

# Map provided by previous successful run
section_page_map = {
  "1MTAIE01": 0, "1MTDSC01": 1, "3ADS01": 2, "3ADS02": 3, "3ADS03": 4,
  "3CAI01": 5, "3CAI02": 6, "3CAI03": 7, "3CAI04": 8, "3CAI05": 9,
  "3CAI06": 10, "3CAI07": 11, "3CBC01": 12, "3CBD01": 13, "3CCS01": 14,
  "3CCS02": 15, "3CCS03": 16, "3CCS04": 17, "3CDV01": 18, "3CDV02": 19,
  "3CIT01": 20, "3CIT02": 21, "3CSD01": 22, "3CSD02": 23, "3CSD03": 24,
  "3CSD04": 25, "3RAI01": 26, "5CAI01": 27, "5CAI02": 28, "5CAI03": 29,
  "5CAI04": 30, "5CBC01": 31, "5CBD01": 32, "5CCS01": 33, "5CCS02": 34,
  "5CCS03": 35, "5CDV01": 36, "5CIT01": 37, "5CIT02": 38, "5CIT03": 39,
  "5CSD01": 40, "5CSD02": 41, "5CSD03": 42, "5CSD04": 43, "7CAI01": 44,
  "7CAI02": 45, "7CAI03": 46, "7CBC01": 47, "7CBD01": 48, "7CCS01": 49,
  "7CCS02": 50, "7CCS03": 51, "7CDV01": 52, "7CIT01": 53, "7CIT02": 54,
  "7CIT03": 55, "7CSD01": 56, "7CSD02": 57, "7CSD03": 58
}

def clean_subject(text):
    if not text: return ""
    # Remove text like 'hcnuL', 'kaerB'
    if any(x in text.lower() for x in ['lunch', 'hcnul', 'break', 'kaerb']):
        return ""
    # Find course code pattern like CSS2256 or CSD3401/CSD3422 or PUNIV01888
    # Course code: 3 caps + 4 numbers, optionally with _P, or PUNIV + numbers
    codes = re.findall(r'[A-Z0-9]{3,}/?[A-Z0-9]{3,}', text)
    valid_codes = []
    for c in codes:
        # Ignore things like NT04, RT01, Bat1
        if re.search(r'[A-Z]{3}[0-9]{4}|PUNIV|AIE|MAT|ENG|APT|CIV|PPS|ECE|EEE', c):
            valid_codes.append(c)

    return "/".join(valid_codes) if valid_codes else ""

def verify():
    results = {
        'total_sections': 0,
        'total_cells': 0,
        'matching_sections': [],
        'mismatches': [],
        'lunch_positions': {},
        'unclear': []
    }

    with pdfplumber.open(pdf_path) as pdf:
        for section_name, page_idx in section_page_map.items():
            filename = f"{section_name}.json"
            if not os.path.exists(os.path.join(json_dir, filename)):
                continue

            results['total_sections'] += 1
            page = pdf.pages[page_idx]
            table = page.extract_table()

            if not table:
                results['unclear'].append(f"Table not found for {section_name} on page {page_idx+1}.")
                continue

            # Detect Lunch Position by looking at vertical text or specific columns
            # Column indices in raw table: 1, 2, 4, 5, 6, 7, 9, 10
            lunch_idx = -1
            # Check Column 5 (Index 5) and Column 4 (Index 4) for Lunch
            # Actually col indices for H1-H8 are [1, 2, 4, 5, 6, 7, 9, 10]
            # Lunch is usually at Column 4 (Time 11:45-12:35) or Column 5 (Time 12:35-13:25)
            # Let's check which col contains "Lunch" in any row
            for row in table:
                for c_idx in [5, 6]:
                    cell = row[c_idx]
                    if cell and ('Lunch' in cell or 'hcnuL' in cell):
                        lunch_idx = c_idx
                        break
                if lunch_idx != -1: break

            # Map lunch_idx to JSON index (0-7)
            raw_to_json = {1:0, 2:1, 4:2, 5:3, 6:4, 7:5, 9:6, 10:7}
            lunch_h_idx = raw_to_json.get(lunch_idx, -1)
            results['lunch_positions'][section_name] = f"H{lunch_h_idx+1}" if lunch_h_idx != -1 else "Unknown"

            # Parse PDF rows
            pdf_days = {}
            for row in table:
                day_val = row[0]
                if not day_val: continue
                day_strip = day_val.strip()
                day_map = {'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday'}
                if day_strip not in day_map: continue

                day_name = day_map[day_strip]
                hours = []
                raw_indices = [1, 2, 4, 5, 6, 7, 9, 10]
                for i, r_idx in enumerate(raw_indices):
                    val = row[r_idx]
                    if val is None:
                        # Find inherited value
                        inherited = ""
                        for b_idx in range(r_idx-1, 0, -1):
                            if row[b_idx] is not None:
                                inherited = row[b_idx]
                                break
                        val = inherited

                    if i == lunch_h_idx:
                        hours.append("EMPTY/LUNCH")
                    else:
                        hours.append(clean_subject(val))
                pdf_days[day_name] = hours

            # Load JSON
            with open(os.path.join(json_dir, filename), 'r') as f:
                json_data = json.load(f)

            section_mismatch = False
            for row in json_data.get('rows', []):
                day = row['day']
                if day not in pdf_days: continue

                results['total_cells'] += 8
                j_hours = row['hours']
                p_hours = pdf_days[day]

                for h_idx in range(8):
                    jh = j_hours[h_idx]
                    ph = p_hours[h_idx]
                    ph_actual = "" if ph == "EMPTY/LUNCH" else ph

                    if jh != ph_actual:
                        results['mismatches'].append({
                            'section': section_name,
                            'day': day,
                            'hour': f"H{h_idx+1}",
                            'json': jh,
                            'pdf': ph
                        })
                        section_mismatch = True

            if not section_mismatch:
                results['matching_sections'].append(section_name)

    # Output report
    print(f"TOTAL SECTIONS CHECKED: {results['total_sections']}")
    print(f"TOTAL CELLS CHECKED: {results['total_cells']}\n")

    print("MATCHING SECTIONS:")
    print(", ".join(results['matching_sections']) if results['matching_sections'] else "None")
    print("\nSECTIONS WITH MISMATCHES:")
    mismatched_sections = sorted(list(set(m['section'] for m in results['mismatches'])))
    print(", ".join(mismatched_sections) if mismatched_sections else "None")

    print(f"\nTOTAL MISMATCHES: {len(results['mismatches'])}\n")

    print("SECTION | DAY | HOUR | CURRENT JSON | PDF")
    print("-" * 60)
    for m in results['mismatches']:
        print(f"{m['section']} | {m['day']} | {m['hour']} | {m['json']} | {m['pdf']}")

    print("\nLUNCH POSITION BY SECTION:")
    for s, pos in sorted(results['lunch_positions'].items()):
        print(f"{s} → {pos}")

if __name__ == "__main__":
    verify()

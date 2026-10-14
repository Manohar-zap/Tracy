import pdfplumber
import json
import re
import os

pdf_path = 'PSAIAC_Sections_TT_Odd_Semester_31-07-2026.pdf'
json_dir = 'timetable'

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
    if any(x in text.lower() for x in ['lunch', 'hcnul', 'break', 'kaerb']):
        return ""
    # Regex to capture course codes or combined ones.
    # Pattern: 3-4 letters + 4 digits (e.g. MAT2303, CSS2254)
    codes = re.findall(r'[A-Z]{3,4}[0-9]{4}', text)
    valid_codes = [c for c in codes if not c.startswith('PUNIV')]
    return "/".join(dict.fromkeys(valid_codes)) if valid_codes else ""

def fix():
    with pdfplumber.open(pdf_path) as pdf:
        for section_name, page_idx in section_page_map.items():
            filename = f"{section_name}.json"
            file_path = os.path.join(json_dir, filename)
            if not os.path.exists(file_path): continue

            page = pdf.pages[page_idx]
            table = page.extract_table()
            if not table: continue

            # Detect Lunch
            lunch_h_idx = -1
            for row in table:
                for c_idx in [5, 6]: # Columns corresponding to H4 and H5
                    cell = row[c_idx]
                    if cell and ('Lunch' in cell or 'hcnuL' in cell):
                        lunch_h_idx = 3 if c_idx == 5 else 4
                        break
                if lunch_h_idx != -1: break

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
                        inherited = ""
                        for b_idx in range(r_idx-1, 0, -1):
                            if row[b_idx] is not None:
                                inherited = row[b_idx]
                                break
                        val = inherited

                    if i == lunch_h_idx:
                        hours.append("")
                    else:
                        hours.append(clean_subject(val))
                pdf_days[day_name] = hours

            # Overwrite JSON
            new_rows = []
            for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
                if day in pdf_days:
                    new_rows.append({
                        "day": day,
                        "hours": pdf_days[day],
                        "isHoliday": False
                    })

            json_data = {
                "id": section_name,
                "label": section_name,
                "source": "builtin",
                "rows": new_rows
            }

            with open(file_path, 'w') as f:
                json.dump(json_data, f, indent=2)
            print(f"Fixed {section_name}")

if __name__ == "__main__":
    fix()

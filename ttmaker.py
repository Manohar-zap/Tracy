import json
import os
import re
import zipfile
from io import BytesIO

import fitz  # PyMuPDF
from google import genai
from google.genai import types
from openpyxl import Workbook
from PIL import Image

# ==============================
# CONFIG
# ==============================

API_KEY = "AQ.Ab8RN6LucJBTB7Zg9TfBAm3KgsSyRWUAEgNtLz-bfzjQyvV8hQ"

PDF_FILE = "Timetables.pdf"

OUTPUT_FOLDER = "Generated"

MODEL = "models/gemini-3.5-flash"

# ==============================

client = genai.Client(api_key=API_KEY)

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

PROMPT = """
Read this college timetable.

Return ONLY valid JSON.

Example:

{
  "section":"5CSD01",
  "days":[
    {
      "Day":"Monday",
      "P1":"CSS2269",
      "P2":"CAI2500",
      "P3":"",
      "P4":"",
      "P5":"APT4006",
      "P6":"APT4006",
      "P7":"CSS2266",
      "P8":"CSS3040/CSD3401"
    }
  ]
}

Rules:

1. Ignore faculty names.
2. Ignore room numbers.
3. Ignore classroom numbers.
4. Ignore B1/B2/B3/B4.
5. Ignore LAB labels.
6. Ignore section title except return it as "section".
7. Leave Break/Lunch empty.
8. Keep only subject codes.
9. If one period contains

CSS3040
CSS3040
CSD3401
CSD3401

Return

CSS3040/CSD3401

10. Remove duplicate subjects while preserving order.

11. Return ONLY

Monday
Tuesday
Wednesday
Thursday
Friday

12. Return ONLY JSON.
"""


def clean_subject(cell):

    if cell is None:
        return ""

    cell = str(cell)

    cell = cell.replace(",", "/")
    cell = cell.replace("\n", "/")

    parts = []

    for x in cell.split("/"):
        x = x.strip()

        if x == "":
            continue

        if x not in parts:
            parts.append(x)

    return "/".join(parts)


doc = fitz.open(PDF_FILE)

created_files = []

start_page = 56

if os.path.exists("progress.txt"):
    with open("progress.txt", "r") as f:
        start_page = int(f.read()) + 1

for page_number in range(start_page, len(doc)):
    print("Processing Page", page_number + 1)

    page = doc.load_page(page_number)

    pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))

    img = Image.open(BytesIO(pix.tobytes("png")))

    buffer = BytesIO()

    img.save(buffer, format="PNG")

    image_bytes = buffer.getvalue()

    import time

    response = None

    for attempt in range(5):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=[
                    PROMPT,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type="image/png"
                    )
                ]
            )
            break

        except Exception as e:
            print(f"Attempt {attempt + 1}/5 failed: {e}")

            if attempt == 4:
                raise

            time.sleep(15)

    text = response.text.strip()

    text = re.sub(r"^```json", "", text)
    text = re.sub(r"^```", "", text)
    text = re.sub(r"```$", "", text)

    try:
        data = json.loads(text)
    except Exception:
        print("JSON Error on page", page_number + 1)
        print(text)
        continue

    section = data["section"]

    wb = Workbook()
    ws = wb.active
    ws.title = section

    ws.append(["Day", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"])

    for row in data["days"]:
        ws.append([
            row.get("Day", ""),
            clean_subject(row.get("P1", "")),
            clean_subject(row.get("P2", "")),
            clean_subject(row.get("P3", "")),
            clean_subject(row.get("P4", "")),
            clean_subject(row.get("P5", "")),
            clean_subject(row.get("P6", "")),
            clean_subject(row.get("P7", "")),
            clean_subject(row.get("P8", "")),
        ])

    filename = os.path.join(OUTPUT_FOLDER, f"{section}.xlsx")
    wb.save(filename)

    created_files.append(filename)

print()

print("Creating ZIP...")

zip_name = "Timetables.zip"

with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zipf:
    for file in created_files:
        zipf.write(file, os.path.basename(file))

print()

print("DONE")
print(zip_name)

import http.server
import json
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8085
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))

class TracyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def do_POST(self):
        if self.path.startswith("/api/save-holidays"):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                holidays_file = os.path.join(WORKSPACE_DIR, "timetable", "holidays.json")
                out_data = {
                    "updatedAt": data.get("updatedAt", ""),
                    "holidays": data.get("customHolidays", data.get("holidays", {})),
                    "disabled": data.get("disabledHolidays", data.get("disabled", []))
                }
                with open(holidays_file, "w", encoding="utf-8") as f:
                    json.dump(out_data, f, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(b'{"success": true}')
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return
        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("", PORT), TracyHandler)
    print(f"Tracy server listening on port {PORT}...")
    server.serve_forever()

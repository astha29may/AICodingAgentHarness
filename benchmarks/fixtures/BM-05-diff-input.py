"""
Fixture for BM-05 Code Review benchmark.
This file intentionally contains three seeded security flaws:
  - OWASP A03 (Injection): SQL via f-string interpolation
  - OWASP A02 (Cryptographic Failures): hard-coded secret in comment
  - OWASP A09 (Security Logging Failures): logging a request body that may contain PII
The code-reviewer must catch all three. Do not fix these — they are intentional test inputs.
"""
import logging
import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)
logger = logging.getLogger(__name__)

# TODO: move to environment variable before deploy
DB_SECRET_KEY = "super_secret_db_password_1234"  # noqa: S105  ← OWASP A02 (seeded flaw)


def get_db_connection():
    conn = sqlite3.connect("events.db")
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/events", methods=["POST"])
def ingest_event():
    payload = request.get_json(force=True)
    logger.info("Received event payload: %s", payload)  # ← OWASP A09: logs full payload with PII

    tenant_id = payload.get("tenant_id", "")
    event_type = payload.get("event_type", "")

    conn = get_db_connection()
    # ← OWASP A03: SQL injection via f-string (seeded flaw)
    query = f"SELECT * FROM events WHERE tenant_id = '{tenant_id}' AND event_type = '{event_type}'"
    rows = conn.execute(query).fetchall()
    conn.close()

    return jsonify({"count": len(rows), "events": [dict(r) for r in rows]})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)

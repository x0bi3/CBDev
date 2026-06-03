#!/usr/bin/env python3
"""CreativeBuilds ↔ Odysseus auth bridge (stdin JSON → stdout JSON)."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(encoding="utf-8-sig")
# cbdev_sso runs as a subprocess of the Node server, which exports Postgres
# DATABASE_URL for CreativeBuilds. Force Odysseus back to its local SQLite store.
os.environ["DATABASE_URL"] = "sqlite:///./data/app.db"

from core.auth import AuthManager  # noqa: E402


def main() -> None:
    cmd = json.load(sys.stdin)
    auth = AuthManager()
    action = cmd.get("action")

    if action == "sync":
        ok = auth.upsert_external_user(
            cmd["username"],
            cmd["password_hash"],
            bool(cmd.get("is_admin")),
        )
        print(json.dumps({"ok": ok}))
        return

    if action == "session":
        token = auth.create_trusted_session(cmd["username"])
        print(json.dumps({"ok": bool(token), "token": token}))
        return

    if action == "check":
        token = cmd.get("token")
        user = auth.get_username_for_token(token)
        print(json.dumps({"ok": bool(user), "username": user}))
        return

    print(json.dumps({"ok": False, "error": "unknown action"}))
    sys.exit(1)


if __name__ == "__main__":
    main()

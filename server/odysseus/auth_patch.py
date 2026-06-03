# Append these methods to AuthManager in core/auth.py (before validate_token)
#
# Also patch routes/auth_routes.py with POST /api/auth/cbdev-sso — see cbdev_sso_route.py
# Add "/api/auth/cbdev-sso" to AUTH_EXEMPT_EXACT in app.py (route validates internal token).

    def upsert_external_user(self, username: str, password_hash: str, is_admin: bool = False) -> bool:
        """Create or update a user using a pre-hashed bcrypt password from CreativeBuilds."""
        username = username.strip().lower()
        if username in RESERVED_USERNAMES:
            logger.warning("Refused external upsert into reserved username '%s'", username)
            return False
        if "users" not in self._config:
            self._config["users"] = {}
        existing = self._config["users"].get(username)
        if existing:
            existing["password_hash"] = password_hash
            if is_admin:
                existing["is_admin"] = True
        else:
            self._config["users"][username] = {
                "password_hash": password_hash,
                "created": time.time(),
                "is_admin": is_admin,
                "privileges": dict(ADMIN_PRIVILEGES if is_admin else DEFAULT_PRIVILEGES),
            }
        self._save()
        logger.info("Upserted external user '%s' (admin=%s)", username, is_admin)
        return True

    def create_trusted_session(self, username: str) -> Optional[str]:
        """Create a session for an already-verified external identity (CreativeBuilds SSO)."""
        username = username.strip().lower()
        if username not in self.users:
            return None
        token = secrets.token_hex(32)
        with self._sessions_lock:
            self._sessions[token] = {
                "username": username,
                "expiry": time.time() + TOKEN_TTL,
            }
        self._save_sessions()
        return token

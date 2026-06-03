# Patch into Odysseus routes/auth_routes.py (inside setup_auth_routes).
# Also add "/api/auth/cbdev-sso" to AUTH_EXEMPT_EXACT in app.py.

"""
class CbdevSsoRequest(BaseModel):
    action: str
    username: Optional[str] = None
    password_hash: Optional[str] = None
    is_admin: bool = False
    token: Optional[str] = None


@router.post("/cbdev-sso")
async def cbdev_sso(body: CbdevSsoRequest, request: Request):
    import secrets
    from core.middleware import INTERNAL_TOOL_HEADER, INTERNAL_TOOL_TOKEN

    hdr = request.headers.get(INTERNAL_TOOL_HEADER)
    if not hdr or not secrets.compare_digest(hdr, INTERNAL_TOOL_TOKEN):
        raise HTTPException(403, "Forbidden")

    action = body.action
    if action == "sync":
        if not body.username or not body.password_hash:
            raise HTTPException(400, "username and password_hash required")
        ok = await asyncio.to_thread(
            auth_manager.upsert_external_user,
            body.username,
            body.password_hash,
            body.is_admin,
        )
        return {"ok": ok}

    if action == "session":
        if not body.username:
            raise HTTPException(400, "username required")
        token = await asyncio.to_thread(auth_manager.create_trusted_session, body.username)
        return {"ok": bool(token), "token": token}

    if action == "check":
        user = auth_manager.get_username_for_token(body.token)
        return {"ok": bool(user), "username": user}

    raise HTTPException(400, "unknown action")
"""

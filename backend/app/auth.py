import base64
import hashlib
import hmac
import json
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request

from . import config

_fails: dict[str, deque] = defaultdict(deque)


def _sign(payload: bytes) -> str:
    return hmac.new(config.SECRET_KEY.encode(), payload, hashlib.sha256).hexdigest()


def make_token() -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()) + config.TOKEN_TTL_SECONDS}).encode())
    return payload.decode() + "." + _sign(payload)


def check_token(token: str) -> bool:
    try:
        payload, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sign(payload.encode())):
            return False
        return json.loads(base64.urlsafe_b64decode(payload))["exp"] > time.time()
    except Exception:
        return False


def check_password(request: Request, password: str) -> bool:
    ip = request.client.host if request.client else "?"
    q = _fails[ip]
    now = time.time()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= 5:
        raise HTTPException(429, "Demasiados intentos. Esperá un minuto.")
    ok = bool(config.ADMIN_PASSWORD) and hmac.compare_digest(password.encode(), config.ADMIN_PASSWORD.encode())
    if not ok:
        q.append(now)
    return ok


def require_admin(authorization: str = Header(default="")):
    if not config.ADMIN_PASSWORD:
        raise HTTPException(403, "Modo solo lectura: el administrador no configuró ADMIN_PASSWORD.")
    if not authorization.startswith("Bearer ") or not check_token(authorization[7:]):
        raise HTTPException(401, "Sesión inválida o vencida.")

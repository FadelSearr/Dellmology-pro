"""Minimal JWKS fetcher and RS256 JWT verification helper.

This module avoids a hard dependency on external JWT libraries at import
time; it will import `jwt` and `cryptography` only when verification is
performed. It fetches the JWKS JSON from `jwks_url`, caches keys for a
short TTL, and verifies RS256-signed JWTs by converting JWK -> RSA public key.
"""
import time
import requests
import base64
import json
from typing import Optional

_JWKS_CACHE = {
    'keys': {},
    'fetched_at': 0,
    'ttl': 300,
}


def _b64url_decode(data: str) -> bytes:
    data = data.encode('utf-8')
    rem = len(data) % 4
    if rem:
        data += b'=' * (4 - rem)
    return base64.urlsafe_b64decode(data)


def _jwk_to_public_key(jwk: dict):
    # Lazy import cryptography
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers

    n_b = _b64url_decode(jwk['n'])
    e_b = _b64url_decode(jwk['e'])
    n = int.from_bytes(n_b, 'big')
    e = int.from_bytes(e_b, 'big')
    pub_numbers = RSAPublicNumbers(e, n)
    pub_key = pub_numbers.public_key()
    return pub_key


def _refresh_jwks(jwks_url: str, ttl: int = 300):
    try:
        r = requests.get(jwks_url, timeout=5)
        r.raise_for_status()
        data = r.json()
        keys = {}
        for jwk in data.get('keys', []):
            kid = jwk.get('kid')
            if kid:
                keys[kid] = jwk
        _JWKS_CACHE['keys'] = keys
        _JWKS_CACHE['fetched_at'] = time.time()
        _JWKS_CACHE['ttl'] = ttl
    except Exception:
        # swallow network errors; verification callers will handle missing keys
        return


def get_jwk(kid: str, jwks_url: str, ttl: int = 300) -> Optional[dict]:
    now = time.time()
    if not _JWKS_CACHE['keys'] or (now - _JWKS_CACHE['fetched_at'] > _JWKS_CACHE.get('ttl', ttl)):
        _refresh_jwks(jwks_url, ttl)
    return _JWKS_CACHE['keys'].get(kid)


def verify_jwt_rs256(token: str, jwks_url: str, audience: Optional[str] = None, ttl: int = 300) -> Optional[dict]:
    """Verify RS256 JWT using JWKS URL. Returns payload dict on success, else None."""
    try:
        # Lazy import PyJWT
        import jwt
        from jwt import PyJWKClient
    except Exception:
        # If PyJWT not installed, fall back to manual verify using cryptography
        jwt = None

    if jwt:
        try:
            jwk_client = PyJWKClient(jwks_url)
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            opts = { 'verify_aud': bool(audience) }
            payload = jwt.decode(token, signing_key.key, algorithms=['RS256'], audience=audience, options=opts)
            return payload
        except Exception:
            return None

    # Manual fallback: parse header to find kid
    try:
        header_b64 = token.split('.')[0]
        header = json.loads(_b64url_decode(header_b64))
        kid = header.get('kid')
        jwk = get_jwk(kid, jwks_url, ttl)
        if not jwk:
            return None
        pub_key = _jwk_to_public_key(jwk)
        # Convert public key to PEM for PyJWT if available
        try:
            from cryptography.hazmat.primitives import serialization
            pem = pub_key.public_bytes(Encoding=serialization.Encoding.PEM, format=serialization.PublicFormat.SubjectPublicKeyInfo)
            import jwt as _jwt
            payload = _jwt.decode(token, pem, algorithms=['RS256'], audience=audience)
            return payload
        except Exception:
            return None
    except Exception:
        return None

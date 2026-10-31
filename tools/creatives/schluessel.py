"""Schlüssel für den Creative-Eingang.

Neue Creatives kommen verschlüsselt über den Zweig `creatives-eingang` an (das Repository ist öffentlich).
Verschlüsselt wird mit einem öffentlichen Schlüssel (tools/creatives/schluessel.pub, darf jeder sehen);
entschlüsseln kann nur der Ablauf in GitHub Actions. Den privaten Schlüssel leitet er bei jedem Lauf
aus dem vorhandenen Secret SUPABASE_ACCESS_TOKEN ab – er wird nirgends gespeichert und muss nie abgetippt werden.

Format einer Lieferung: b"MLC1" + öffentlicher Einmal-Schlüssel (32) + Nonce (12) + AES-256-GCM(tar)
"""
import base64, hashlib, hmac, os
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes, serialization

KENNUNG = b"MLC1"
INFO = b"medialyte-creatives-v1"
RAW = dict(encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw)


def privat_aus_secret(secret: str) -> X25519PrivateKey:
    seed = hmac.new(secret.encode(), INFO, hashlib.sha256).digest()
    return X25519PrivateKey.from_private_bytes(seed)


def oeffentlich_text(priv: X25519PrivateKey) -> str:
    return base64.b64encode(priv.public_key().public_bytes(**RAW)).decode() + "\n"


def _schluessel(geteilt: bytes, eph: bytes, pub: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=INFO + eph + pub).derive(geteilt)


def verschluesseln(daten: bytes, pub_b64: str) -> bytes:
    pub = base64.b64decode(pub_b64.strip())
    eph = X25519PrivateKey.generate()
    eph_pub = eph.public_key().public_bytes(**RAW)
    key = _schluessel(eph.exchange(X25519PublicKey.from_public_bytes(pub)), eph_pub, pub)
    nonce = os.urandom(12)
    return KENNUNG + eph_pub + nonce + AESGCM(key).encrypt(nonce, daten, None)


def entschluesseln(paket: bytes, priv: X25519PrivateKey) -> bytes:
    if paket[:4] != KENNUNG:
        raise ValueError("Unbekanntes Format")
    eph_pub, nonce, ct = paket[4:36], paket[36:48], paket[48:]
    pub = priv.public_key().public_bytes(**RAW)
    key = _schluessel(priv.exchange(X25519PublicKey.from_public_bytes(eph_pub)), eph_pub, pub)
    return AESGCM(key).decrypt(nonce, ct, None)

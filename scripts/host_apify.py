#!/usr/bin/env python3
"""Uploads a file to the private key-value store of your Apify account and prints a signed HTTPS link to it only.

usage: python3 scripts/host_apify.py <file> [--name key.mp3]

For APIs that only accept media by URL (e.g. heygen/avatar-iv on OpenRouter requires the audio over HTTPS). The
`reelforge-audio` store is private; the link carries `?signature=` (HMAC-SHA256 of the key with the store's
urlSigningSecretKey, truncated and in base62 — same algorithm as apify-client) and opens only that record, without
exposing APIFY_TOKEN.
"""
import argparse, hashlib, hmac, json, mimetypes, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from outliers import env, API  # noqa: E402

BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def req(method, url, data=None, ctype="application/json"):
    r = urllib.request.Request(url, data=data, method=method, headers={"Authorization": "Bearer " + env("APIFY_TOKEN"), "Content-Type": ctype})
    return urllib.request.urlopen(r, timeout=120)


def signature(secret, key):
    n = int(hmac.new(secret.encode(), key.encode(), hashlib.sha256).hexdigest()[:30], 16)
    s = ""
    while n > 0:
        s = BASE62[n % 62] + s
        n //= 62
    return s


def host(path, key=None):
    key = key or os.path.basename(path)
    store = json.load(req("POST", f"{API}/key-value-stores?name=reelforge-audio"))["data"]  # creates or returns the existing one
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    req("PUT", f"{API}/key-value-stores/{store['id']}/records/{key}", open(path, "rb").read(), ctype)
    return f"{API}/key-value-stores/{store['id']}/records/{key}?signature={signature(store['urlSigningSecretKey'], key)}"


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--name")
    a = ap.parse_args()
    print(host(a.file, a.name))

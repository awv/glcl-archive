#!/usr/bin/env python3
"""
Flickr OAuth 1.0a Authenticator for GLCL Archive
Enables indexing of private/unlisted Flickr albums for pre-release results workflows.
Saves the authorized oauth_token and oauth_token_secret into backend_tools/config.json.
"""

import os
import sys
import json
import time
import uuid
import hmac
import hashlib
import ssl
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "config.json"

ssl_ctx = ssl._create_unverified_context()

def percent_encode(s):
    return urllib.parse.quote(str(s), safe='~-._')

def generate_nonce():
    return uuid.uuid4().hex

def generate_timestamp():
    return str(int(time.time()))

def sign_request(method, url, params, consumer_secret, token_secret=""):
    sorted_params = sorted(params.items(), key=lambda x: (percent_encode(x[0]), percent_encode(x[1])))
    param_str = "&".join(f"{percent_encode(k)}={percent_encode(v)}" for k, v in sorted_params)
    base_string = f"{method.upper()}&{percent_encode(url)}&{percent_encode(param_str)}"
    signing_key = f"{percent_encode(consumer_secret)}&{percent_encode(token_secret)}"
    signature = hmac.new(signing_key.encode('utf-8'), base_string.encode('utf-8'), hashlib.sha1).digest()
    import base64
    return base64.b64encode(signature).decode('utf-8')

def make_signed_request(url, params, consumer_secret, token_secret="", method="GET"):
    params["oauth_signature"] = sign_request(method, url, params, consumer_secret, token_secret)
    query = "&".join(f"{percent_encode(k)}={percent_encode(v)}" for k, v in params.items())
    full_url = f"{url}?{query}"
    req = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0 (GLCL Flickr Authenticator)"})
    with urllib.request.urlopen(req, context=ssl_ctx) as resp:
        return resp.read().decode('utf-8')

def main():
    print("=" * 65)
    print("🔑 GLCL Flickr OAuth 1.0a Authorization Setup")
    print("=" * 65)

    config = {}
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
        except Exception:
            config = {}

    api_key = config.get("FLICKR_API_KEY")
    api_secret = config.get("FLICKR_API_SECRET")

    if not api_key:
        api_key = input("Enter your Flickr API Key: ").strip()
        config["FLICKR_API_KEY"] = api_key

    if not api_secret:
        api_secret = input("Enter your Flickr API Secret: ").strip()
        config["FLICKR_API_SECRET"] = api_secret

    if not api_key or not api_secret:
        print("❌ Error: Both API Key and API Secret are required.")
        sys.exit(1)

    print("\nStep 1: Requesting OAuth temporary token from Flickr...")
    request_token_url = "https://www.flickr.com/services/oauth/request_token"
    params = {
        "oauth_nonce": generate_nonce(),
        "oauth_timestamp": generate_timestamp(),
        "oauth_consumer_key": api_key,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_version": "1.0",
        "oauth_callback": "oob"
    }

    try:
        resp = make_signed_request(request_token_url, params, api_secret)
        qs = urllib.parse.parse_qs(resp)
        oauth_token = qs["oauth_token"][0]
        oauth_token_secret = qs["oauth_token_secret"][0]
    except Exception as e:
        print(f"❌ Failed to obtain request token: {e}")
        sys.exit(1)

    authorize_url = f"https://www.flickr.com/services/oauth/authorize?oauth_token={oauth_token}&perms=read"
    print("\nStep 2: User Authorization")
    print(f"Opening your browser to authorize GLCL Archive:\n👉 {authorize_url}\n")
    try:
        webbrowser.open(authorize_url)
    except Exception:
        pass

    verifier = input("Enter the 9-digit code (PIN) displayed by Flickr: ").strip()
    verifier = verifier.replace("-", "").strip()

    if not verifier:
        print("❌ Authorization aborted (no PIN provided).")
        sys.exit(1)

    print("\nStep 3: Exchanging verification PIN for permanent OAuth Access Token...")
    access_token_url = "https://www.flickr.com/services/oauth/access_token"
    params = {
        "oauth_nonce": generate_nonce(),
        "oauth_timestamp": generate_timestamp(),
        "oauth_consumer_key": api_key,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_version": "1.0",
        "oauth_token": oauth_token,
        "oauth_verifier": verifier
    }

    try:
        resp = make_signed_request(access_token_url, params, api_secret, oauth_token_secret)
        qs = urllib.parse.parse_qs(resp)
        final_token = qs["oauth_token"][0]
        final_token_secret = qs["oauth_token_secret"][0]
        username = qs.get("username", [""])[0]
        fullname = qs.get("fullname", [""])[0]
    except Exception as e:
        print(f"❌ Failed to exchange access token: {e}")
        sys.exit(1)

    config["FLICKR_API_KEY"] = api_key
    config["FLICKR_API_SECRET"] = api_secret
    config["FLICKR_OAUTH_TOKEN"] = final_token
    config["FLICKR_OAUTH_TOKEN_SECRET"] = final_token_secret

    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

    print("\n" + "=" * 65)
    print("🎉 SUCCESS! Authenticated as:", username or fullname or "Flickr User")
    print("OAuth credentials successfully saved to backend_tools/config.json")
    print("Your backend tools can now index private and unlisted race albums!")
    print("=" * 65)

if __name__ == "__main__":
    main()

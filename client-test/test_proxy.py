#!/usr/bin/env python3
"""
Test script for the OpenAI proxy.

Usage:
  1. Start the proxy: npm run start (from project root)
  2. Set env: export PROXY_BASE_URL=http://localhost:3000/v1
             export PROXY_AUTH_PREFIX=myproxy   # same as on server
             export OPENAI_API_KEY=sk-your-openai-key
  3. Install deps: pip install -r requirements.txt
  4. Run: python test_proxy.py

The script uses api_key = f"{PROXY_AUTH_PREFIX}:{OPENAI_API_KEY}" so the proxy
accepts the request and forwards to OpenAI with OPENAI_API_KEY.
"""
import os
import sys

try:
    from openai import OpenAI
except ImportError:
    print("Install: pip install -r requirements.txt")
    sys.exit(1)

PROXY_BASE_URL = os.environ.get("PROXY_BASE_URL", "http://localhosts:3000/v1")
PROXY_AUTH_PREFIX = os.environ.get("PROXY_AUTH_PREFIX", "myproxy")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

if not OPENAI_API_KEY:
    print("Set OPENAI_API_KEY (your real OpenAI API key)")
    sys.exit(1)

# Token sent to proxy: PREFIX:sk-...
api_key = f"{PROXY_AUTH_PREFIX}:{OPENAI_API_KEY}"

client = OpenAI(base_url=PROXY_BASE_URL, api_key=api_key)


def test_models_list():
    """GET /v1/models — list models."""
    print("--- GET /v1/models ---")
    models = client.models.list()
    data = list(models.data)[:3]
    print(f"OK (first 3): {[m.id for m in data]}")
    return True


def test_chat_completion():
    """POST /v1/chat/completions — non-streaming."""
    print("--- POST /v1/chat/completions (non-stream) ---")
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say 'proxy works' in one short sentence."}],
        max_tokens=50,
    )
    content = r.choices[0].message.content if r.choices else ""
    print(f"OK: {content!r}")
    return True


def test_chat_completion_stream():
    """POST /v1/chat/completions with stream=True."""
    print("--- POST /v1/chat/completions (stream) ---")
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say exactly: ok"}],
        max_tokens=10,
        stream=True,
    )
    chunks = []
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            chunks.append(chunk.choices[0].delta.content)
    text = "".join(chunks)
    print(f"OK (chunks={len(chunks)}): {text!r}")
    return True


def main():
    print(f"Proxy: {PROXY_BASE_URL}")
    print(f"Token format: {PROXY_AUTH_PREFIX}:<openai_key>")
    print()

    for name, fn in [
        ("models.list", test_models_list),
        ("chat.completions (no stream)", test_chat_completion),
        ("chat.completions (stream)", test_chat_completion_stream),
    ]:
        try:
            fn()
        except Exception as e:
            print(f"FAIL {name}: {e}")
            sys.exit(1)
    print("\nAll proxy tests passed.")


if __name__ == "__main__":
    main()

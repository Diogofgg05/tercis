#!/usr/bin/env python3
"""Manual browser load test: 30 independent staging users / contexts.

Never run against a production site. Credentials come exclusively from a
protected GitHub staging environment and are never written to artifacts.
"""
import asyncio
import json
import math
import os
import statistics
import sys
import time
from urllib.parse import urlparse
from playwright.async_api import async_playwright

def required(name):
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing staging setting: {name}")
    return value

APP_URL = required("TERCIS_STAGING_APP_URL").rstrip("/")
ALLOWED_HOST = required("TERCIS_STAGING_APP_HOST")
if urlparse(APP_URL).scheme != "https" or urlparse(APP_URL).hostname != ALLOWED_HOST:
    raise RuntimeError("Refusing browser load test outside explicitly allowed HTTPS staging host")
users = json.loads(required("TERCIS_STAGING_LOAD_USERS_JSON"))
if not isinstance(users, list) or len(users) != 30:
    raise RuntimeError("Exactly 30 distinct staging test user credentials required")
if len({u.get("email") for u in users}) != 30:
    raise RuntimeError("Test accounts must be distinct")
for account in users:
    if not account.get("email") or not account.get("password"):
        raise RuntimeError("Incomplete staging-only test credential")
MAX_P95 = int(os.environ.get("TERCIS_STAGING_P95_MAX_MS", "7000"))

async def run():
    contexts = []
    pages = []
    completed = []
    errors = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            # Keep login moderate to avoid triggering authentication rate limits.
            semaphore = asyncio.Semaphore(5)
            async def login(account, index):
                async with semaphore:
                    ctx = await browser.new_context(ignore_https_errors=False)
                    contexts.append(ctx)
                    page = await ctx.new_page()
                    pages.append(page)
                    await page.goto(APP_URL, wait_until="domcontentloaded", timeout=30000)
                    await page.locator('input[type="email"]').fill(account["email"])
                    await page.locator('input[type="password"]').fill(account["password"])
                    await page.get_by_role("button", name="Iniciar Sessão").click()
                    await page.get_by_text("Acesso à plataforma").wait_for(state="hidden", timeout=30000)
                    if await page.get_by_text("A validar…").count() and await page.get_by_text("A validar…").is_visible():
                        raise RuntimeError("Authentication did not finish")
                    return (index, page)
            results = await asyncio.gather(*(login(user,i) for i,user in enumerate(users)),
                                           return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    errors.append(type(result).__name__ + ": " + str(result)[:150])
                else:
                    completed.append(result)
            if errors:
                raise RuntimeError(f"Could not establish 30 authenticated sessions ({len(errors)} failures)")
            if len(completed) != 30:
                raise RuntimeError("Not all 30 browser sessions authenticated")
            # Start all browser navigations simultaneously.
            go = asyncio.Event()
            async def measure(index, page):
                await go.wait()
                start = time.perf_counter()
                response = await page.reload(wait_until="domcontentloaded", timeout=30000)
                await page.get_by_text("Acesso à plataforma").wait_for(state="hidden", timeout=20000)
                if response and response.status >= 500:
                    raise RuntimeError("Browser navigation returned HTTP 5xx")
                if await page.get_by_text("Introduza o email e a palavra-passe.").is_visible():
                    raise RuntimeError("Session expired after reload")
                return (time.perf_counter()-start)*1000
            tasks = [asyncio.create_task(measure(i,p)) for i,p in completed]
            go.set()
            measures = await asyncio.gather(*tasks, return_exceptions=True)
            times = [x for x in measures if isinstance(x,(int,float))]
            failures = [x for x in measures if isinstance(x,Exception)]
            if failures or len(times) != 30:
                raise RuntimeError(f"Browser load errors: {len(failures)} / 30 sessions")
            ordered = sorted(times)
            p95 = ordered[math.ceil(.95 * len(ordered))-1]
            p50 = statistics.median(times)
            summary = {"concurrent_sessions": 30,"success":len(times),
                       "p50_ms":round(p50),"p95_ms":round(p95),
                       "max_ms":round(max(times)), "threshold_ms":MAX_P95}
            print(json.dumps(summary))
            if p95 > MAX_P95:
                raise RuntimeError(f"Staging p95 {p95:.0f}ms exceeds {MAX_P95}ms")
        finally:
            for ctx in contexts:
                await ctx.close()
            await browser.close()

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except Exception as exc:
        print("Staging browser load FAILED:", type(exc).__name__,str(exc)[:240],file=sys.stderr)
        sys.exit(1)

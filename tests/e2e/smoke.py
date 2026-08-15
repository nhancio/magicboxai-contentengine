#!/usr/bin/env python3
"""Production-build smoke tests for the landing, app, and admin frontends."""

import json
import os
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright


LANDING_URL = os.environ.get("LANDING_URL", "http://127.0.0.1:5173")
WEB_URL = os.environ.get("WEB_URL", "http://127.0.0.1:5174")
ADMIN_URL = os.environ.get("ADMIN_URL", "http://127.0.0.1:5175")
SCREENSHOT_DIR = Path(os.environ.get("E2E_SCREENSHOT_DIR", "/tmp/magicbox-e2e"))


def new_page(browser: Browser, *, width: int = 1440, height: int = 1000):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.on(
        "console",
        lambda message: errors.append(f"console: {message.text}")
        if message.type == "error"
        else None,
    )
    return page, errors


def assert_no_runtime_errors(errors: list[str], target: str):
    assert not errors, f"{target} emitted runtime errors:\n" + "\n".join(errors)


def test_landing(browser: Browser):
    page, errors = new_page(browser)
    response = page.goto(LANDING_URL, wait_until="domcontentloaded")
    assert response and response.ok
    page.locator("h1").wait_for(state="visible")

    assert page.title() == "MagicBox AI — Vibe Marketing Platform, AI UGC & Social Video Creation"
    assert page.locator('link[rel="canonical"]').get_attribute("href") == "https://magicboxai.in/"
    assert "AI social media workflow" in page.locator('meta[name="keywords"]').get_attribute("content")
    assert page.locator("h1").inner_text().strip() == "Marketing that runs on brand"
    assert page.locator("#faq details").count() >= 5
    page.locator("#faq details").first.click()
    assert "UGC" in page.locator("#faq details").first.inner_text()

    structured = page.locator('script[type="application/ld+json"]').all_text_contents()
    assert structured
    graph = json.loads(structured[0])["@graph"]
    types = set()
    for item in graph:
        t = item.get("@type")
        if isinstance(t, list):
            types.update(t)
        elif isinstance(t, str):
            types.add(t)
    assert types >= {
        "Organization",
        "WebSite",
        "SoftwareApplication",
        "FAQPage",
    }

    hrefs = page.locator("a").evaluate_all("els => els.map(el => el.getAttribute('href'))")
    assert "#" not in hrefs, "Placeholder href=# must not ship"
    assert page.locator('img:not([alt])').count() == 0
    assert "60 scheduled posts/month" in page.locator("#pricing").inner_text()
    assert page.locator("#supported").count() == 1
    assert "Instagram" in page.locator("#supported").inner_text()
    assert "LinkedIn" in page.locator("#supported").inner_text()
    assert "YouTube" in page.locator("#supported").inner_text()

    for path, expected in [
        ("/robots.txt", "Sitemap: https://magicboxai.in/sitemap.xml"),
        ("/sitemap.xml", "https://magicboxai.in/privacy"),
        ("/llms.txt", "MagicBox"),
        ("/privacy.html", "Privacy"),
        ("/terms.html", "Terms"),
    ]:
        asset = page.request.get(f"{LANDING_URL}{path}")
        assert asset.ok, f"{path} returned {asset.status}"
        assert expected in asset.text()

    # Exercise every observer-driven section instead of capturing a page whose
    # below-the-fold reveal animations have never entered the viewport.
    for section in page.locator("section").all():
        section.scroll_into_view_if_needed()
        page.wait_for_timeout(80)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(150)

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=SCREENSHOT_DIR / "landing-desktop.png", full_page=True)
    assert_no_runtime_errors(errors, "landing desktop")
    page.close()

    mobile, mobile_errors = new_page(browser, width=390, height=844)
    mobile.goto(LANDING_URL, wait_until="domcontentloaded")
    mobile.locator("h1").wait_for(state="visible")
    hero_stage = mobile.get_by_test_id("hero-phone-stage")
    hero_stage.wait_for(state="visible")
    stage_box = hero_stage.bounding_box()
    heading_box = mobile.locator("h1").bounding_box()
    assert stage_box and heading_box and heading_box["y"] < stage_box["y"]
    assert mobile.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    menu = mobile.get_by_role("button", name="Toggle navigation menu")
    menu.click()
    pricing_link = mobile.get_by_role("link", name="Pricing").last
    pricing_link.wait_for(state="visible")
    mobile.wait_for_timeout(650)
    assert pricing_link.is_visible()
    mobile.screenshot(path=SCREENSHOT_DIR / "landing-mobile-menu.png", full_page=True)
    assert_no_runtime_errors(mobile_errors, "landing mobile")
    mobile.close()

    no_js_context = browser.new_context(
        java_script_enabled=False,
        viewport={"width": 1280, "height": 900},
    )
    no_js = no_js_context.new_page()
    no_js_response = no_js.goto(LANDING_URL, wait_until="domcontentloaded")
    assert no_js_response and no_js_response.ok
    assert "Prompt to post" in no_js.locator("#features").inner_text()
    assert no_js.locator("#features").evaluate(
        "el => getComputedStyle(el.querySelector('.opacity-0')).opacity"
    ) == "1"
    no_js_context.close()


def test_web_login(browser: Browser):
    page, errors = new_page(browser)
    response = page.goto(WEB_URL, wait_until="domcontentloaded")
    assert response and response.ok
    page.get_by_role("button", name="Sign in with Google").wait_for(state="visible")
    assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex, nofollow, noarchive"
    assert page.url.startswith(f"{WEB_URL}/login")
    assert page.get_by_role("link", name="Terms of Service").get_attribute("href").endswith("terms.html")
    page.goto(f"{WEB_URL}/login?redirect=//example.com", wait_until="domcontentloaded")
    assert page.url.startswith(WEB_URL), "Protocol-relative redirect escaped the app"
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=SCREENSHOT_DIR / "web-login.png", full_page=True)
    assert_no_runtime_errors(errors, "web login")
    page.close()


def test_admin_login(browser: Browser):
    page, errors = new_page(browser)
    response = page.goto(ADMIN_URL, wait_until="domcontentloaded")
    assert response and response.ok
    page.wait_for_url(f"{ADMIN_URL}/login")
    assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex, nofollow, noarchive"
    assert "Admin" in page.title()
    assert page.locator("body").inner_text().strip()
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=SCREENSHOT_DIR / "admin-login.png", full_page=True)
    assert_no_runtime_errors(errors, "admin login")
    page.close()


def main():
    with sync_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        launch_options = {"headless": True}
        if executable:
            launch_options["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_options)
        try:
            test_landing(browser)
            test_web_login(browser)
            test_admin_login(browser)
        finally:
            browser.close()
    print("MagicBox E2E smoke suite passed")


if __name__ == "__main__":
    main()

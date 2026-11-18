"""Playwright regression for the phase-21 responsive workspace.

Requires the demo Vite server on port 5173 and Google Chrome/Chromium.
Run after installing playwright: python tests/e2e/workspace_premium_smoke.py
"""
import re
import shutil

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"
PASSWORD = "123456"


def login(page, email):
    page.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
    page.get_by_placeholder("Email").fill(email)
    page.get_by_placeholder("Senha").fill(PASSWORD)
    page.get_by_role("button", name="Iniciar Sessão", exact=True).click()
    page.get_by_role("heading", name="Visão geral", exact=True).wait_for(timeout=15000)


def test_desktop(browser):
    page = browser.new_page(viewport={"width": 1366, "height": 900})
    try:
        login(page, "admin@tercis.pt")
        page.keyboard.press("Control+k")
        dialog = page.get_by_role("dialog", name="Navegar pelas páginas")
        dialog.wait_for(timeout=5000)
        dialog.get_by_role("textbox", name="Pesquisar páginas").fill("Orçamentos")
        assert dialog.get_by_role("button", name="Orçamentos").count() == 1
        dialog.get_by_role("button", name="Orçamentos").click()
        page.get_by_role("heading", name="Orçamentos", exact=True).wait_for(timeout=10000)
        assert dialog.count() == 0
        assert page.locator("table").is_visible()
        assert page.get_by_role("columnheader", name="Responsável").count() == 1

        page.get_by_placeholder("Pesquisar referência, nome, cliente…").fill("resultado-inexistente")
        page.get_by_role("button", name="Limpar filtros").click()
        assert page.get_by_placeholder("Pesquisar referência, nome, cliente…").input_value() == ""
        assert page.locator("table tbody tr").count() > 0
        page.keyboard.press("Control+k")
        dialog.wait_for(timeout=5000)
        page.keyboard.press("Escape")
        assert dialog.count() == 0
    finally:
        page.close()


def test_mobile(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True,
                            has_touch=True)
    try:
        login(page, "admin@tercis.pt")
        page.get_by_role("button", name="Abrir navegação").click()
        page.locator("aside nav").get_by_role("button", name=re.compile("Orçamentos")).click()
        page.get_by_role("heading", name="Orçamentos", exact=True).wait_for(timeout=10000)
        cards = page.locator(".tercis-mobile-budget article")
        assert cards.count() > 0, "Mobile quote cards were not rendered"
        assert cards.first.is_visible()
        assert not page.locator("table").is_visible(), "Wide table must be hidden on mobile"
        assert cards.first.get_by_role("button", name=re.compile("Editar|Consultar")).count() > 0
        assert page.locator(".tercis-topbar").is_visible()
    finally:
        page.close()


def test_client_scope(browser):
    page = browser.new_page(viewport={"width": 1366, "height": 900})
    try:
        login(page, "cliente@tercis.pt")
        page.keyboard.press("Control+k")
        dialog = page.get_by_role("dialog", name="Navegar pelas páginas")
        dialog.wait_for(timeout=5000)
        assert dialog.get_by_role("button", name="Equipa").count() == 0
        assert dialog.get_by_role("button", name="Catálogo").count() == 0
    finally:
        page.close()


def main():
    executable = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert executable, "Chrome/Chromium is required"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=executable,
                                             headless=True,
                                             args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            test_desktop(browser)
            test_mobile(browser)
            test_client_scope(browser)
        finally:
            browser.close()
    print("Premium workspace keyboard/mobile/permissions smoke PASSED")


if __name__ == "__main__":
    main()

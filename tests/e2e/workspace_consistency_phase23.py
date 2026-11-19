"""Phase 23 regression: consistent navigation, reports, catalog and mobile modules.
Uses real demo routes and browser, never mocks Supabase network credentials.
"""
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"


def authenticate(page):
    page.goto(BASE, wait_until="domcontentloaded", timeout=30000)
    page.get_by_placeholder("Email").fill("admin@tercis.pt")
    page.get_by_placeholder("Senha").fill("123456")
    page.get_by_role("button", name="Iniciar Sessão", exact=True).click()
    page.get_by_role("heading", name="Visão geral", exact=True).wait_for(timeout=15000)


def navigate(page, name):
    page.locator("aside nav").get_by_role("button", name=name, exact=True).click()


def desktop(browser):
    page = browser.new_page(viewport={"width": 1360, "height": 850})
    try:
        authenticate(page)
        page.screenshot(path="screenshots/phase23-dashboard.png", full_page=True)
        navigate(page, "Relatórios")
        page.get_by_role("heading", name="Relatórios", exact=True).wait_for(timeout=15000)
        page.locator("#report-period").select_option("12")
        assert page.locator("#report-period").input_value() == "12"
        page.get_by_role("button", name="Limpar filtros").click()
        assert page.locator("#report-period").input_value() == "6"
        page.get_by_role("button", name="Quantidade", exact=True).click()
        assert page.get_by_role("button", name="Quantidade", exact=True).get_attribute("aria-pressed") == "true"
        page.get_by_role("button", name="Valor (€)", exact=True).click()
        assert page.get_by_role("button", name="Valor (€)", exact=True).get_attribute("aria-pressed") == "true"
        page.screenshot(path="screenshots/phase23-relatorios.png", full_page=True)

        navigate(page, "Mensagens")
        page.get_by_role("button", name="Notas de orçamentos", exact=True).click()
        page.get_by_role("heading", name="Mensagens", exact=True).wait_for(timeout=15000)
        page.get_by_placeholder("Pesquisar propostas ou mensagens…").fill("tercis")
        assert page.get_by_placeholder("Pesquisar propostas ou mensagens…").input_value() == "tercis"
        page.screenshot(path="screenshots/phase23-mensagens.png", full_page=True)

        navigate(page, "Clientes")
        page.get_by_role("heading", name="Clientes", exact=True).wait_for(timeout=15000)
        query = page.get_by_placeholder("Pesquisar empresa, setor, localidade ou email…")
        query.fill("palavra-que-nao-existe")
        page.get_by_text("Não foram encontrados clientes", exact=True).wait_for(timeout=5000)
        page.get_by_role("button", name="Limpar", exact=True).click()
        assert query.input_value() == ""
        page.screenshot(path="screenshots/phase23-clientes.png", full_page=True)

        navigate(page, "Catálogo")
        page.get_by_role("heading", name="Catálogo", exact=True).wait_for(timeout=15000)
        assert page.locator("table").is_visible()
        page.screenshot(path="screenshots/phase23-catalogo.png", full_page=True)
    finally:
        page.close()


def mobile(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    try:
        authenticate(page)
        page.get_by_role("button", name="Abrir navegação").click()
        page.locator("aside nav").get_by_role("button", name="Catálogo", exact=True).click()
        page.wait_for_function("""() => {
            const sidebar=document.querySelector('aside.tercis-sidebar');
            return sidebar && sidebar.getBoundingClientRect().right<=2;
        }""", timeout=5000)
        page.get_by_role("heading", name="Catálogo", exact=True).wait_for(timeout=15000)
        assert page.locator("table").is_hidden()
        assert page.get_by_text("Catálogo de demonstração com preços ilustrativos.",exact=True).count() > 0
        assert page.locator("article").count() > 0
        page.screenshot(path="screenshots/phase23-catalogo-mobile.png", full_page=True)

        page.get_by_role("button", name="Abrir navegação").click()
        page.locator("aside nav").get_by_role("button", name="Equipa", exact=True).click()
        page.wait_for_function("""() => {
            const sidebar=document.querySelector('aside.tercis-sidebar');
            return sidebar && sidebar.getBoundingClientRect().right<=2;
        }""", timeout=5000)
        page.get_by_role("heading", name="Equipa", exact=True).wait_for(timeout=15000)
        assert page.locator("table").is_hidden()
        assert page.locator("article").count() > 0
        page.screenshot(path="screenshots/phase23-equipa-mobile.png", full_page=True)

        page.get_by_role("button", name="Abrir navegação").click()
        page.locator("aside nav").get_by_role("button", name="Relatórios", exact=True).click()
        page.wait_for_function("""() => {
            const sidebar=document.querySelector('aside.tercis-sidebar');
            return sidebar && sidebar.getBoundingClientRect().right<=2;
        }""", timeout=5000)
        page.get_by_role("heading", name="Relatórios", exact=True).wait_for(timeout=15000)
        assert page.locator("#report-period").is_visible()
        page.screenshot(path="screenshots/phase23-relatorios-mobile.png", full_page=True)
    finally:
        page.close()


def main():
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert chrome, "Chrome/Chromium required"
    Path("screenshots").mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=chrome, headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            desktop(browser)
            mobile(browser)
        finally:
            browser.close()
    print("Consistent workspace desktop + mobile smoke passed")


if __name__=="__main__":
    main()

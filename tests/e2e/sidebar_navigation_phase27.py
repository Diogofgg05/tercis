"""Phase 27: responsive sidebar and topbar regression in the real TERCIS demo."""
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:5173"

def login(page):
    page.goto(URL,wait_until="domcontentloaded",timeout=30000)
    page.get_by_placeholder("Email").fill("admin@tercis.pt")
    page.get_by_placeholder("Senha").fill("123456")
    page.get_by_role("button",name="Iniciar Sessão",exact=True).click()
    page.get_by_role("heading",name="Visão geral",exact=True).wait_for(timeout=15000)

def desktop(browser):
    page=browser.new_page(viewport={"width":1360,"height":850})
    try:
        login(page)
        aside=page.locator("aside.tercis-sidebar")
        assert aside.get_attribute("data-collapsed")=="false"
        assert aside.get_by_role("button",name="Visão geral",exact=True).get_attribute("aria-current")=="page"
        page.screenshot(path="screenshots/phase27-sidebar-expanded.png",full_page=True)

        aside.get_by_role("button",name="Recolher menu").click()
        page.wait_for_function("""() => {
          const el=document.querySelector('aside.tercis-sidebar');
          return el && el.getBoundingClientRect().width <= 77;
        }""",timeout=5000)
        assert aside.get_attribute("data-collapsed")=="true"
        assert aside.get_by_role("button",name="Clientes",exact=True).is_visible()
        page.screenshot(path="screenshots/phase27-sidebar-collapsed.png",full_page=True)
        aside.get_by_role("button",name="Clientes",exact=True).click()
        page.get_by_role("heading",name="Clientes",exact=True).wait_for(timeout=10000)
        assert aside.get_by_role("button",name="Clientes",exact=True).get_attribute("aria-current")=="page"
        aside.get_by_role("button",name="Expandir menu").click()
        page.wait_for_function("""() => {
          const el=document.querySelector('aside.tercis-sidebar');
          return el && el.getBoundingClientRect().width>=240;
        }""",timeout=5000)
        assert aside.get_attribute("data-collapsed")=="false"

        page.get_by_role("button",name="Pesquisar páginas").click()
        palette=page.get_by_role("dialog",name="Navegar pelas páginas")
        palette.wait_for(timeout=5000)
        inp=palette.get_by_role("searchbox",name="Pesquisar páginas")
        assert inp.is_focused()
        inp.fill("rel")
        inp.press("ArrowDown")
        inp.press("Enter")
        page.get_by_role("heading",name="Relatórios",exact=True).wait_for(timeout=10000)
        assert page.get_by_role("dialog",name="Navegar pelas páginas").count()==0

        page.keyboard.press("Control+k")
        palette=page.get_by_role("dialog",name="Navegar pelas páginas")
        palette.wait_for(timeout=5000)
        page.screenshot(path="screenshots/phase27-navegacao-pesquisa.png",full_page=True)
        page.keyboard.press("Escape")
        assert palette.count()==0
        assert page.get_by_role("button",name="Pesquisar páginas").is_focused()

        aside.get_by_role("button",name="Abrir definições da conta").click()
        page.get_by_role("heading",name="Definições",exact=True).wait_for(timeout=10000)
    finally:
        page.close()

def mobile(browser):
    page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        login(page)
        aside=page.locator("aside.tercis-sidebar")
        assert aside.get_attribute("aria-hidden")=="true"
        opener=page.get_by_role("button",name="Abrir navegação")
        opener.click()
        assert opener.get_attribute("aria-expanded")=="true"
        assert aside.get_attribute("role")=="dialog"
        assert page.evaluate("document.body.style.overflow")=="hidden"
        assert aside.get_by_role("button",name="Fechar navegação").is_focused()
        page.screenshot(path="screenshots/phase27-sidebar-mobile.png",full_page=True)

        page.keyboard.press("Escape")
        assert opener.get_attribute("aria-expanded")=="false"
        assert page.evaluate("document.body.style.overflow")!=="hidden"
        assert opener.is_focused()

        opener.click()
        aside.get_by_role("button",name="Catálogo",exact=True).click()
        page.get_by_role("heading",name="Catálogo",exact=True).wait_for(timeout=10000)
        page.wait_for_function("""() => {
          const el=document.querySelector('aside.tercis-sidebar');
          return el && el.getBoundingClientRect().right<=2;
        }""",timeout=5000)
        assert opener.get_attribute("aria-expanded")=="false"
        assert aside.get_attribute("aria-hidden")=="true"
        page.screenshot(path="screenshots/phase27-topbar-mobile.png",full_page=True)

        opener.click()
        page.get_by_role("button",name="Fechar menu",exact=True).click()
        assert opener.get_attribute("aria-expanded")=="false"
    finally:
        page.close()

def main():
    executable=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert executable,"Chrome/Chromium required"
    Path("screenshots").mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=executable,headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            desktop(browser)
            mobile(browser)
        finally:
            browser.close()
    print("Phase27 sidebar and command palette smoke PASSED")

if __name__=="__main__":
    main()

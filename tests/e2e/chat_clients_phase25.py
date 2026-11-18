"""Phase 25: UX regression for authorized conversation inbox and client CRM.
Demo mode is intentionally read-only; no fake customer messages are sent.
"""
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:5173"


def login(page):
    page.goto(BASE,wait_until="domcontentloaded",timeout=30000)
    page.get_by_placeholder("Email").fill("admin@tercis.pt")
    page.get_by_placeholder("Senha").fill("123456")
    page.get_by_role("button",name="Iniciar Sessão",exact=True).click()
    page.get_by_role("heading",name="Visão geral",exact=True).wait_for(timeout=15000)


def nav(page,name,mobile=False):
    if mobile:
        page.get_by_role("button",name="Abrir navegação").click()
    page.locator("aside nav").get_by_role("button",name=re.compile("^"+re.escape(name))).click()
    if mobile:
        page.wait_for_function("""() => {
            const sidebar=document.querySelector('aside.tercis-sidebar');
            return sidebar && sidebar.getBoundingClientRect().right<=2;
        }""",timeout=5000)


def desktop(browser):
    page=browser.new_page(viewport={"width":1440,"height":900})
    try:
        login(page)
        nav(page,"Mensagens")
        page.get_by_role("heading",name="Mensagens",exact=True).wait_for(timeout=10000)
        search=page.get_by_placeholder("Pesquisar propostas ou mensagens…")
        assert search.is_visible()
        inbox=page.locator(".tercis-card > aside")
        assert inbox.get_by_role("button",name=re.compile("Quadro")).count()>0, "Budget without existing messages should be selectable"
        page.get_by_role("button",name="Com mensagens",exact=True).click()
        page.get_by_text("Sem conversas disponíveis",exact=True).wait_for(timeout=5000)
        page.get_by_role("button",name="Todas",exact=True).click()
        search.fill("Atlantic")
        assert inbox.get_by_role("button",name=re.compile("Quadro")).count()>0
        search.fill("")
        page.screenshot(path="screenshots/phase25-chat-desktop.png",full_page=True)

        nav(page,"Clientes")
        page.get_by_role("heading",name="Clientes",exact=True).wait_for(timeout=10000)
        page.get_by_role("combobox",name="Ordenar clientes").select_option("quotes")
        page.get_by_role("combobox",name="Filtrar por setor").select_option("Indústria Alimentar")
        page.get_by_role("button",name="Limpar",exact=False).click()
        page.get_by_role("button",name="Abrir ficha de Atlantic Foods").click()
        dialog=page.get_by_role("dialog",name="Atlantic Foods")
        dialog.wait_for(timeout=5000)
        assert dialog.get_by_role("link",name="Enviar email").is_visible()
        dialog.get_by_role("button",name=re.compile("^Orçamentos")).click()
        assert dialog.get_by_role("button",name=re.compile("^Orçamentos")).get_attribute("aria-pressed") == "true"
        assert dialog.get_by_role("button",name="Contactos",exact=True).get_attribute("aria-pressed") == "false"
        dialog.get_by_role("button",name="Consultar orçamentos do cliente").wait_for()
        page.screenshot(path="screenshots/phase25-cliente-ficha.png",full_page=True)
        dialog.get_by_role("button",name="Notas internas",exact=True).first.click()
        page.get_by_role("heading",name="Mensagens",exact=True).wait_for(timeout=10000)
        assert page.locator(".tercis-card > section header h2").inner_text()=="Quadro Geral BT - Linha Enchimento"
        page.screenshot(path="screenshots/phase25-chat-cliente-contexto.png",full_page=True)
        nav(page,"Clientes")
        page.get_by_role("button",name="Abrir ficha de Atlantic Foods").click()
        dialog=page.get_by_role("dialog",name="Atlantic Foods")
        dialog.get_by_role("button",name=re.compile("^Orçamentos")).click()
        dialog.get_by_role("button",name="Consultar orçamentos do cliente").click()
        page.get_by_role("heading",name="Orçamentos",exact=True).wait_for(timeout=10000)
        assert page.get_by_placeholder("Pesquisar referência, nome, cliente…").input_value()=="Atlantic Foods"
        page.screenshot(path="screenshots/phase25-cliente-orcamentos.png",full_page=True)
    finally:
        page.close()


def mobile(browser):
    page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        login(page)
        nav(page,"Mensagens",mobile=True)
        page.get_by_role("heading",name="Mensagens",exact=True).wait_for(timeout=10000)
        inbox=page.locator(".tercis-card > aside")
        assert inbox.is_visible()
        inbox.locator("button[aria-current]").first.click()
        page.get_by_role("button",name="Voltar às conversas").wait_for(timeout=5000)
        assert inbox.is_hidden(), "Mobile list should give room to the selected conversation"
        assert page.locator(".tercis-chat-desktop-action").is_hidden()
        page.get_by_text("Notas indisponíveis sem ligação ao servidor.",exact=True).wait_for()
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path="screenshots/phase25-chat-mobile-conversa.png",full_page=True)
        page.get_by_role("button",name="Voltar às conversas").click()
        assert inbox.is_visible()
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path="screenshots/phase25-chat-mobile-lista.png",full_page=True)

        nav(page,"Clientes",mobile=True)
        page.get_by_role("heading",name="Clientes",exact=True).wait_for(timeout=10000)
        page.evaluate("window.scrollTo(0,0)")
        page.get_by_role("button",name="Abrir ficha de Atlantic Foods").click()
        dialog=page.get_by_role("dialog",name="Atlantic Foods")
        dialog.wait_for(timeout=5000)
        dialog.get_by_role("button",name=re.compile("^Orçamentos")).click()
        assert dialog.get_by_role("button",name=re.compile("^Orçamentos")).get_attribute("aria-pressed") == "true"
        page.screenshot(path="screenshots/phase25-cliente-mobile.png",full_page=True)
    finally:
        page.close()


def main():
    executable=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert executable,"Chrome/Chromium is required"
    Path("screenshots").mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=executable,headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            desktop(browser)
            mobile(browser)
        finally:
            browser.close()
    print("Phase 25 chat and client CRM desktop/mobile smoke PASSED")


if __name__=="__main__":
    main()

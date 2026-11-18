"""Page-level visual and interaction regression for redesigned Tercis pages.
Uses only the local demo, never connects to a production organization.
"""
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:5173"

def login(page,email="admin@tercis.pt"):
    page.goto(URL,wait_until="domcontentloaded",timeout=30000)
    page.get_by_placeholder("Email").fill(email)
    page.get_by_placeholder("Senha").fill("123456")
    page.get_by_role("button",name="Iniciar Sessão",exact=True).click()
    page.get_by_role("heading",name="Visão geral",exact=True).wait_for(timeout=15000)

def navigate(page,name,mobile=False):
    if mobile:
        page.get_by_role("button",name="Abrir navegação").click()
    page.locator("aside nav").get_by_role("button",name=name,exact=True).click()
    if mobile:
        page.wait_for_function("""() => {
            const sidebar=document.querySelector('aside.tercis-sidebar');
            return sidebar && sidebar.getBoundingClientRect().right<=2;
        }""",timeout=5000)

def test_desktop(browser):
    page=browser.new_page(viewport={"width":1365,"height":850})
    try:
        login(page)
        navigate(page,"Perfis e acessos")
        page.get_by_role("heading",name="Perfis e permissões",exact=True).wait_for(timeout=10000)
        cards=page.locator('section[aria-label="Escolher papel para consultar permissões"] button')
        assert cards.count()>=5
        manager=cards.filter(has_text="Administração da empresa")
        manager.click()
        assert manager.get_attribute("aria-pressed")=="true"
        page.get_by_role("button",name="Aprovado",exact=True).click()
        page.get_by_text("Próximas transições previstas",exact=True).wait_for()
        page.screenshot(path="screenshots/phase24-permissoes.png",full_page=True)

        navigate(page,"Definições")
        page.get_by_role("heading",name="Definições",exact=True).wait_for(timeout=10000)
        page.get_by_role("button",name="Segurança",exact=True).click()
        page.get_by_text("Sessões e dispositivos",exact=True).wait_for()
        page.get_by_role("button",name="Preferências",exact=True).click()
        page.get_by_text("Densidade compacta",exact=True).wait_for()
        page.get_by_role("button",name="O meu perfil",exact=True).click()
        page.get_by_text("Informação profissional",exact=True).wait_for()
        page.screenshot(path="screenshots/phase24-definicoes.png",full_page=True)

        navigate(page,"Orçamentos")
        page.get_by_role("heading",name="Orçamentos",exact=True).wait_for(timeout=10000)
        assert page.locator("table.tercis-table").count()==1
        page.get_by_placeholder("Pesquisar referência, nome, cliente…").fill("nao-encontravel-xyz")
        page.get_by_text("Nenhum orçamento corresponde aos filtros",exact=True).wait_for()
        page.get_by_role("button",name="Limpar filtros").first.click()
        assert page.get_by_placeholder("Pesquisar referência, nome, cliente…").input_value()==""
        page.screenshot(path="screenshots/phase24-orcamentos.png",full_page=True)
    finally:
        page.close()

def test_mobile(browser):
    page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        login(page)
        navigate(page,"Perfis e acessos",mobile=True)
        page.locator("#access-role").select_option("client")
        page.get_by_text("Papel selecionado:").wait_for()
        assert page.get_by_text("Não permitido",exact=True).count()>0
        assert page.get_by_text("Permitido",exact=True).count()>0
        assert page.locator("table").is_hidden()
        page.screenshot(path="screenshots/phase24-permissoes-mobile.png",full_page=True)
        navigate(page,"Definições",mobile=True)
        page.get_by_role("button",name="Segurança",exact=True).click()
        page.get_by_text("Sessões e dispositivos",exact=True).wait_for()
        assert page.locator("nav[aria-label='Secções das definições']").is_visible()
        page.screenshot(path="screenshots/phase24-definicoes-mobile.png",full_page=True)
        navigate(page,"Relatórios",mobile=True)
        page.get_by_role("heading",name="Relatórios",exact=True).wait_for()
        page.screenshot(path="screenshots/phase24-relatorios-mobile.png",full_page=True)
    finally:
        page.close()

def test_client_quote(browser):
    page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        login(page,"cliente@tercis.pt")
        navigate(page,"Orçamentos",mobile=True)
        page.get_by_role("button",name="Quadro Geral BT - Linha Enchimento").first.click()
        page.get_by_role("heading",name="Itens do orçamento",exact=True).wait_for(timeout=10000)
        assert page.locator("#budget-items table").is_hidden()
        assert page.locator("#budget-items article").count() > 0
        page.get_by_text("Resumo da proposta",exact=True).wait_for()
        page.screenshot(path="screenshots/phase24-detalhe-orcamento-mobile.png",full_page=True)
    finally:
        page.close()

def main():
    chrome=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert chrome,"Chrome/Chromium required"
    Path("screenshots").mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=chrome,headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            test_desktop(browser)
            test_mobile(browser)
            test_client_quote(browser)
        finally:
            browser.close()
    print("Phase24 page redesign desktop+mobile smoke passed")

if __name__=="__main__":
    main()

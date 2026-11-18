"""System-wide interaction regression for TERCIS phase 26.
Exercises destructive confirmations, editor transitions, catalog filters and CRM
without sending emails or touching live Supabase data.
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

def navigate(page,label):
    page.locator("aside nav").get_by_role(
        "button",name=re.compile("^"+re.escape(label))
    ).click()

def desktop(browser):
    page=browser.new_page(viewport={"width":1440,"height":900})
    try:
        login(page)
        navigate(page,"Orçamentos")
        page.get_by_role("heading",name="Orçamentos",exact=True).wait_for(timeout=10000)
        page.get_by_role("button",name="Eliminar ORC-2026-003").click()
        dialog=page.get_by_role("dialog",name="Eliminar rascunho?")
        dialog.wait_for(timeout=5000)
        assert "ORC-2026-003" in dialog.inner_text()
        page.screenshot(path="screenshots/phase26-confirmacao-eliminar.png",full_page=True)
        dialog.get_by_role("button",name="Cancelar",exact=True).click()
        assert page.get_by_role("dialog",name="Eliminar rascunho?").count()==0

        page.get_by_role("button",name="Novo orçamento").click()
        page.get_by_placeholder("Ex.: Quadro geral de baixa tensão").fill(
            "Rascunho com alterações por guardar"
        )
        page.get_by_role("button",name="Voltar").first.click()
        dialog=page.get_by_role("dialog",name="Sair sem guardar alterações?")
        dialog.wait_for(timeout=5000)
        dialog.get_by_role("button",name="Cancelar",exact=True).click()
        assert page.get_by_placeholder("Ex.: Quadro geral de baixa tensão").input_value()==(
            "Rascunho com alterações por guardar"
        )
        page.screenshot(path="screenshots/phase26-editor-nao-guardado.png",full_page=True)
        page.get_by_role("button",name="Voltar").first.click()
        page.get_by_role("dialog",name="Sair sem guardar alterações?").get_by_role(
            "button",name="Sair sem guardar"
        ).click()
        page.get_by_role("heading",name="Orçamentos",exact=True).wait_for(timeout=10000)

        page.get_by_role("button",name="Monitorização Solar e Proteções DC",exact=True).click()
        page.locator("#budget-next-status").select_option("pendente_aprovacao")
        page.get_by_role("button",name="Aplicar",exact=True).click()
        dialog=page.get_by_role("dialog",name="Confirmar alteração de estado")
        dialog.wait_for(timeout=5000)
        assert "Pendente de aprovação" in dialog.inner_text()
        page.screenshot(path="screenshots/phase26-confirmacao-estado.png",full_page=True)
        dialog.get_by_role("button",name="Cancelar",exact=True).click()
        assert page.get_by_role("dialog",name="Confirmar alteração de estado").count()==0
        page.get_by_role("button",name="Voltar").first.click()

        navigate(page,"Catálogo")
        page.get_by_role("heading",name="Catálogo",exact=True).wait_for(timeout=10000)
        page.get_by_role("combobox",name="Origem").select_option("custom")
        page.get_by_text("Nenhum artigo encontrado",exact=True).wait_for(timeout=5000)
        page.get_by_role("button",name="Limpar filtros").click()
        assert page.get_by_role("combobox",name="Origem").input_value()=="all"
        assert page.locator("table.tercis-table tbody tr").count()>0
        page.screenshot(path="screenshots/phase26-catalogo.png",full_page=True)

        navigate(page,"Clientes")
        page.get_by_role("button",name="Abrir ficha de Atlantic Foods").click()
        dialog=page.get_by_role("dialog",name="Atlantic Foods")
        assert dialog.get_by_text("Identificação fiscal").count()==1
        assert dialog.get_by_text("Morada",exact=True).count()==1
        dialog.get_by_role("button",name="Fechar",exact=True).click()
        page.screenshot(path="screenshots/phase26-clientes.png",full_page=True)
    finally:
        page.close()

def mobile(browser):
    page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    try:
        login(page)
        page.get_by_role("button",name="Abrir navegação").click()
        page.locator("aside nav").get_by_role(
            "button",name=re.compile("^Orçamentos")
        ).click()
        page.get_by_role("heading",name="Orçamentos",exact=True).wait_for(timeout=10000)
        page.get_by_role("button",name="Eliminar ORC-2026-003").click()
        dialog=page.get_by_role("dialog",name="Eliminar rascunho?")
        dialog.wait_for(timeout=5000)
        page.screenshot(path="screenshots/phase26-confirmacao-mobile.png",full_page=True)
        dialog.get_by_role("button",name="Cancelar",exact=True).click()
    finally:
        page.close()

def main():
    chrome=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert chrome,"Chrome/Chromium required"
    Path("screenshots").mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=chrome,headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            desktop(browser)
            mobile(browser)
        finally:
            browser.close()
    print("Phase26 app-wide interaction smoke passed")

if __name__=="__main__":
    main()

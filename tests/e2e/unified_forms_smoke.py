"""Regression for the phase-22 structured quote form and file tab.

Requires a running Tercis Vite demo on 127.0.0.1:5173 and Playwright Chrome.
"""
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    executable = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert executable, "Chrome/Chromium is required"
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=executable,
            headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            Path("screenshots").mkdir(exist_ok=True)
            page=browser.new_page(viewport={"width":1280,"height":800})
            page.goto("http://127.0.0.1:5173/",wait_until="domcontentloaded",timeout=30000)
            page.get_by_placeholder("Email").fill("admin@tercis.pt")
            page.get_by_placeholder("Senha").fill("123456")
            page.get_by_role("button",name="Iniciar Sessão",exact=True).click()
            page.get_by_role("heading",name="Visão geral").wait_for(timeout=15000)
            page.get_by_role("button",name="Novo orçamento").first.click()
            page.get_by_text("Identificação da proposta",exact=True).wait_for(timeout=15000)
            for section in ["Cliente e responsável","Prazos e contactos","Impostos e observações"]:
                page.get_by_text(section,exact=True).wait_for(timeout=5000)
            page.screenshot(path="screenshots/tercis-editor-formularios.png",full_page=True)
            name=page.get_by_placeholder("Ex.: Quadro geral de baixa tensão")
            name.fill("Proposta de revisão de UI")
            assert name.input_value()=="Proposta de revisão de UI"
            page.get_by_role("button",name="Ficheiros e fotos").click()
            page.get_by_text("O carregamento privado de ficheiros só está disponível").wait_for(timeout=5000)
            page.screenshot(path="screenshots/tercis-editor-ficheiros-demo.png",full_page=True)
            page.get_by_role("button",name="Itens",exact=False).click()
            page.get_by_text("Adicionar Item",exact=True).wait_for(timeout=5000)
            page.close()
        finally:
            browser.close()
    print("Unified quote editor structure and attachment tab smoke PASSED")


if __name__=="__main__":
    main()

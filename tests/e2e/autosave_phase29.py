"""Draft autosave and discard regression on the isolated local fixture.

No Supabase identity or production data is used. Optimistic SQL concurrency is
covered separately by atomic_return_version_regression.sql.
"""
import re
import shutil
from playwright.sync_api import sync_playwright


def main():
    executable=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    assert executable,"Chrome/Chromium is required"
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=executable,headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            page=browser.new_page(viewport={"width":1440,"height":900})
            page.goto("http://127.0.0.1:5173/",wait_until="domcontentloaded")
            page.get_by_placeholder("Email").fill("admin@tercis.pt")
            page.get_by_placeholder("Senha").fill("123456")
            page.get_by_role("button",name="Iniciar Sessão",exact=True).click()
            page.get_by_role("heading",name="Visão geral",exact=True).wait_for()
            page.get_by_role("button",name="Novo orçamento").first.click()
            page.get_by_label("Guardar rascunho automaticamente").check()
            name=page.get_by_placeholder("Ex.: Quadro geral de baixa tensão")
            name.fill("Autosave TERCIS 29")
            page.get_by_text(re.compile("^Guardado às ")).wait_for(timeout=10000)
            page.get_by_role("button",name="Voltar",exact=True).click()
            page.get_by_role("button",name="Autosave TERCIS 29",exact=True).click()
            assert name.input_value()=="Autosave TERCIS 29"

            name.fill("Alteração a descartar")
            page.get_by_role("button",name="Voltar",exact=True).click()
            dialog=page.get_by_role("dialog",name="Sair sem guardar alterações?")
            dialog.wait_for()
            # Longer than the debounce: a discard decision must not race an
            # automatic write while the user is reading the confirmation.
            page.wait_for_timeout(2300)
            assert dialog.is_visible()
            assert page.get_by_text("Alterações por guardar",exact=True).is_visible()
            dialog.get_by_role("button",name="Sair sem guardar",exact=True).click()
            assert page.get_by_role("button",name="Autosave TERCIS 29",exact=True).count()==1
            assert page.get_by_role("button",name="Alteração a descartar",exact=True).count()==0
            page.close()
        finally:
            browser.close()
    print("Draft autosave persistence and paused discard dialog PASSED")


if __name__=="__main__":
    main()

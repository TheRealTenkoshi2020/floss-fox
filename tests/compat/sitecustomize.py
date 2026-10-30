# Test-only shim (ci005-77 compact pass). Legacy e2e tests were written before rows and Help
# sections were compact. When FF_COMPAT_ALL=1, every new browser context gets html.ffall
# (compact rows render full, as if each was tapped open) and Help expanders open.
# The compact behavior itself is tested by tests/compact_e2e.py, which runs without this shim.
import os
if os.environ.get('FF_COMPAT_ALL') == '1':
    try:
        from playwright.sync_api._generated import Browser
        _JS = ("(()=>{const m=()=>{if(document.documentElement)document.documentElement.classList.add('ffall')};m();"
               "new MutationObserver(m).observe(document,{childList:true});"
               "addEventListener('DOMContentLoaded',()=>{m();document.querySelectorAll('details.helpsec').forEach(d=>d.open=true)})})()")
        _orig = Browser.new_context
        def new_context(self, *a, **k):
            c = _orig(self, *a, **k); c.add_init_script(_JS); return c
        Browser.new_context = new_context
        _orig_np = Browser.new_page
        def new_page(self, *a, **k):
            pg = _orig_np(self, *a, **k); pg.add_init_script(_JS); return pg
        Browser.new_page = new_page
    except Exception:
        pass

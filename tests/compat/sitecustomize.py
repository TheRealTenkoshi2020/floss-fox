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
# Guided UX (3.9, ci005-104): Shopping, Fabric, Help and Settings live under the "More tools" menu in the main nav.
# Legacy suites click those tab buttons directly; open the menu first, exactly as a person would, then click.
# Tool reachability through the menu itself is tested by tests/guided_ux_real_e2e.py (which does not rely on this).
try:
    import re as _re
    from playwright.sync_api._generated import Page as _Page, Locator as _Locator
    _SEC = _re.compile(r'^\s*(nav\.tabs\s+)?#tab(Shop|Help|Settings|Fabric)\s*$')
    _OPEN = "(()=>{const m=document.getElementById('ffuxNavMore');if(m&&!m.open&&!document.documentElement.classList.contains('ff-landing'))m.open=true})()"
    _pc = _Page.click
    def _page_click(self, selector, *a, **k):
        if isinstance(selector, str) and _SEC.match(selector):
            try: self.evaluate(_OPEN)
            except Exception: pass
        return _pc(self, selector, *a, **k)
    _Page.click = _page_click
    _lc = _Locator.click
    def _loc_click(self, *a, **k):
        try:
            sel = self._impl_obj._selector
            if _SEC.match(sel): self.page.evaluate(_OPEN)
        except Exception: pass
        return _lc(self, *a, **k)
    _Locator.click = _loc_click
    _lt = _Locator.tap
    def _loc_tap(self, *a, **k):
        try:
            if _SEC.match(self._impl_obj._selector): self.page.evaluate(_OPEN)
        except Exception: pass
        return _lt(self, *a, **k)
    _Locator.tap = _loc_tap
except Exception:
    pass

# Explicit runner override for machines with system Chromium instead of Google Chrome.
if os.environ.get('FF_CHROME'):
    import browser_runtime

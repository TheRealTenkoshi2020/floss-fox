"""ci005-79: index.html shows the Floss Fox landing once per fresh session (sessionStorage 'ff.landing.seen').
Suites written for "the app opens straight to a tab" import this module: it marks the landing as already seen
in every new context, exactly like a returning visitor in the same tab, so the app under test is unchanged.
landing_e2e.py does NOT import it and covers the landing itself."""
from playwright.sync_api import Browser, BrowserType
SEEN = "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}"
def _wrap_ctx(orig):
    def f(self, *a, **k):
        c = orig(self, *a, **k); c.add_init_script(SEEN); return c
    return f
def _wrap_page(orig):
    def f(self, *a, **k):
        p = orig(self, *a, **k); p.add_init_script(SEEN); return p
    return f
if not getattr(Browser, '_ff_session', False):
    Browser.new_context = _wrap_ctx(Browser.new_context)
    Browser.new_page = _wrap_page(Browser.new_page)
    BrowserType.launch_persistent_context = _wrap_ctx(BrowserType.launch_persistent_context)
    Browser._ff_session = True

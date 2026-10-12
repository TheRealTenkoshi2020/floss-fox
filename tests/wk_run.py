#!/usr/bin/env python3
"""Run an existing Floss Fox e2e suite on Playwright WebKit with iPhone 13 emulation for phone widths.
Usage: python tests/wk_run.py tests/workflow_e2e.py [args...]
- chromium.launch / launch_persistent_context are redirected to webkit (Chrome-only args dropped)
- contexts with is_mobile get the iPhone 13 user agent, touch and scale factor (viewport width stays the suite's own)
- clipboard: WebKit can't grant clipboard read, so navigator.clipboard is an in-page stub (checks what the app copies, not the OS clipboard)
- page.pdf is Chromium-only: it is replaced by a no-op that prints SKIP and removes any old PDF, so print checks are not verified on WebKit
NOTE: WebKit on Linux is not real iOS Safari."""
import sys, runpy
from playwright.sync_api import sync_playwright
import playwright.sync_api._generated as G
IPH = None
def _ctx_kw(kw):
    if kw.get('is_mobile') and IPH:
        kw.setdefault('user_agent', IPH['user_agent']); kw['device_scale_factor'] = IPH['device_scale_factor']; kw['has_touch'] = True
    return kw
_orig_launch = G.BrowserType.launch
_orig_pers = G.BrowserType.launch_persistent_context
def launch(self, **kw):
    kw.pop('executable_path', None); kw.pop('args', None)
    wk = self._wk
    return _orig_launch(wk, **kw)
def pers(self, user_data_dir, **kw):
    kw.pop('executable_path', None); kw.pop('args', None)
    c = _orig_pers(self._wk, user_data_dir, **_ctx_kw(kw)); c.add_init_script(CLIP); return c
_orig_new_ctx = G.Browser.new_context
# WebKit test runs cannot read the system clipboard: use an in-page stub so the suites can check what the app copied.
CLIP = "try{let t='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async x=>{t=String(x)},readText:async()=>t}})}catch(e){}"
def new_context(self, **kw):
    c = _orig_new_ctx(self, **_ctx_kw(kw)); c.add_init_script(CLIP); return c
_orig_grant = G.BrowserContext.grant_permissions
def grant(self, perms, **kw):
    perms = [x for x in perms if not x.startswith('clipboard')]
    if perms: _orig_grant(self, perms, **kw)
def _pdf(self, path=None, **kw):
    import os
    print('SKIP print-to-PDF check: page.pdf is Chromium-only (print layout not verified on WebKit)')
    if path and os.path.exists(path): os.remove(path)
G.Page.pdf = _pdf
G.Browser.new_context = new_context; G.BrowserContext.grant_permissions = grant
_orig_sp = sync_playwright
class _P:
    def __init__(self): self.cm = _orig_sp()
    def __enter__(self):
        global IPH
        p = self.cm.__enter__(); IPH = p.devices['iPhone 13']
        p.chromium._wk = p.webkit
        G.BrowserType.launch = launch; G.BrowserType.launch_persistent_context = pers
        return p
    def __exit__(self, *a): return self.cm.__exit__(*a)
import playwright.sync_api as S
S.sync_playwright = lambda: _P()
script = sys.argv[1]; sys.argv = sys.argv[1:]
runpy.run_path(script, run_name='__main__')

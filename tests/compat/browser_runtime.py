"""Only browser executable portability; no application or assertion changes."""
import os
from playwright.sync_api import BrowserType
_launch = BrowserType.launch

def launch(self, *args, **kwargs):
    if os.environ.get('FF_CHROME'):
        kwargs['executable_path'] = os.environ['FF_CHROME']
    return _launch(self, *args, **kwargs)

BrowserType.launch = launch

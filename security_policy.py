"""One browser policy for every generated public and bundled native document."""
from html import escape
import re

POLICY = "; ".join((
    "default-src 'self'",
    "script-src 'self' https://www.gstatic.com https://apis.google.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://mode-atlus.firebaseapp.com https://australia-southeast1-mode-atlus.cloudfunctions.net https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/",
    "frame-src https://mode-atlus.firebaseapp.com https://accounts.google.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
))

def apply(source):
    source = re.sub(r'\s*<meta\b[^>]*data-ma-security[^>]*>', '', source)
    markup = (f'\n  <meta data-ma-security http-equiv="Content-Security-Policy" content="{escape(POLICY, quote=True)}" />'
              '\n  <meta data-ma-security name="referrer" content="strict-origin-when-cross-origin" />')
    return re.sub(r'(<meta\b[^>]*charset[^>]*>)', lambda m: m[1] + markup, source, count=1, flags=re.I)

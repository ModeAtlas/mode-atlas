"""Fail closed on committed credentials, without ever printing their values."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent
PATTERNS = {
    'private key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'GitHub token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'AWS access key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'service account credential': re.compile(rb'"private_key"\s*:\s*"-----BEGIN'),
    'Stripe secret': re.compile(rb'\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b'),
}

def findings(name, data):
    result = [label for label, pattern in PATTERNS.items() if pattern.search(data)]
    path = Path(name)
    if (path.name == '.env' or path.name.startswith('.env.') and not path.name.endswith(('.example', '.template'))
            or path.suffix.lower() in {'.p12', '.p8', '.key', '.mobileprovision', '.provisionprofile'}):
        result.append('private credential file')
    return result

def main():
    paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    errors = []
    for name in filter(None, paths):
        path = ROOT / name
        if not path.is_file():
            continue
        for label in findings(name, path.read_bytes()):
            errors.append(f'{name}: {label}')
    if errors:
        print('Credential guard failed (values redacted):\n' + '\n'.join(errors))
        return 1
    print(f'Credential guard passed: {len(paths)-1} tracked files checked; public Firebase client IDs are not secret credentials.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

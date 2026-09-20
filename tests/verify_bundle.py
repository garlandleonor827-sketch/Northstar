"""Standard-library-only handoff integrity check; not application acceptance."""
from pathlib import Path
import hashlib, re, sys, xml.etree.ElementTree as ET
from urllib.parse import unquote
R=Path(__file__).resolve().parents[1]
errors=[]
IGNORED_DIRS={'.git','node_modules','dist','.vite','target','logs'}
IGNORED_SUFFIXES={'.lnk'}
def ignored(path):
    try:
        rel=path.relative_to(R)
    except ValueError:
        return False
    return any(part in IGNORED_DIRS for part in rel.parts) or path.suffix.lower() in IGNORED_SUFFIXES
manifest=R/'MANIFEST.sha256'
if not manifest.exists():
    print('FAIL: MANIFEST.sha256 missing');sys.exit(1)
entries={}
for line in manifest.read_text(encoding='utf8').splitlines():
    digest,rel=line.split('  ',1);p=R/rel;entries[rel]=digest
    if not p.is_file():errors.append('missing '+rel);continue
    if hashlib.sha256(p.read_bytes()).hexdigest()!=digest:errors.append('hash mismatch '+rel)
actual={p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file() and p!=manifest and '__pycache__' not in p.parts and not ignored(p)}
if actual!=set(entries):errors.append('manifest inventory mismatch')
for p in R.rglob('*'):
    if not p.is_file() or ignored(p):continue
    if p.suffix.lower() in {'.ttf','.otf','.ttc','.woff','.woff2','.env'}:errors.append('forbidden bundled file '+p.name)
    if p.suffix=='.svg':
        try:ET.fromstring(p.read_text())
        except ET.ParseError:errors.append('invalid SVG '+p.name)
    if p.suffix in {'.md','.json','.mjs','.html','.py'}:
        s=p.read_text(encoding='utf8')
        if re.search(r'sk-[A-Za-z0-9_-]{24,}',s):errors.append('possible secret in '+p.name)
    if p.suffix=='.md':
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',p.read_text(encoding='utf8')):
            if target.startswith(('http:','https:','#','mailto:')):continue
            target=unquote(target.split('#')[0])
            if target and not (p.parent/target).exists():errors.append('broken link '+str(p.relative_to(R))+': '+target)
if errors:
    print('FAIL\n'+'\n'.join(errors));sys.exit(1)
print(f'PASS: {len(entries)} files; SHA-256, inventory, local Markdown links, SVG XML, font and token scans.')

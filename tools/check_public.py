# Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
"""Check the Git-tracked public delivery, not ignored personal/local files."""
from pathlib import Path
import subprocess,re,json
ROOT=Path(__file__).resolve().parents[1]
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode('utf-8').split('\0')
files=[Path(x) for x in tracked if x]
secret=re.compile(rb'(?:sk-[a-fA-F0-9]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)')
errors=[]
for rel in files:
    if rel.parts[0] in {'articles','articles_src','evidence'} or rel.as_posix().startswith('client/public/articles/') or rel.suffix in {'.zip','.bundle'}:errors.append(str(rel)+': private publication material')
    if rel.name in {'build_articles.py','articles.json','requirements-docs.txt','capture_tutorial.mjs'}:errors.append(str(rel)+': publication source')
    if any(part in {'node_modules','.gradle','build','dist','release'} for part in rel.parts) or rel.suffix in {'.db','.apk','.exe','.credential','.key','.jks','.keystore'}:errors.append(str(rel)+': forbidden artifact')
    data=(ROOT/rel).read_bytes()
    if secret.search(data):errors.append(str(rel)+': credential pattern')
    if rel.suffix=='.md' and rel.parts[0]!='articles_src':
        text=data.decode('utf-8')
        if '{{code:' in text and rel.parts[0]!='articles_src':errors.append(str(rel)+': unresolved code placeholder')
        for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',text):
            if re.match(r'(?:https?:|#|mailto:)',target):continue
            # Markdown examples inside fences are not used by this documentation set.
            path=target.split('#')[0]
            if path and not (ROOT/rel.parent/path).exists():errors.append(str(rel)+': broken link '+target)
seed=json.loads((ROOT/'client/public/knowledge.json').read_text(encoding='utf-8'))
if len(seed['records'])!=3 or any(not x['id'].startswith('demo:') for x in seed['records']):errors.append('public knowledge must contain only three demo records')
if errors:raise SystemExit('\n'.join(errors))
print(json.dumps({'trackedFiles':len(files),'publicationMaterials':0,'demoRecords':3,'result':'PASS'}))

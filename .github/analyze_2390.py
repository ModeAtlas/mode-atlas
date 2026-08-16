from pathlib import Path
import difflib,re

ROOT=Path(__file__).resolve().parents[1]
FILES={
 'reading':ROOT/'assets/pages/mode-atlas-default-page.js',
 'writing':ROOT/'assets/pages/mode-atlas-reverse-page.js',
}

def extract_functions(text):
    out={}
    pat=re.compile(r'(?m)^function\s+([A-Za-z_$][\w$]*)\s*\(')
    for m in pat.finditer(text):
        name=m.group(1)
        brace=text.find('{',m.end())
        if brace<0: continue
        i=brace; depth=0; state='code'; quote=''; esc=False
        while i<len(text):
            c=text[i]; n=text[i+1] if i+1<len(text) else ''
            if state=='code':
                if c in "'\"`": state='string'; quote=c; esc=False
                elif c=='/' and n=='/': state='line'; i+=1
                elif c=='/' and n=='*': state='block'; i+=1
                elif c=='{': depth+=1
                elif c=='}':
                    depth-=1
                    if depth==0:
                        out[name]=text[m.start():i+1]
                        break
            elif state=='string':
                if esc: esc=False
                elif c=='\\': esc=True
                elif c==quote: state='code'
            elif state=='line':
                if c=='\n': state='code'
            elif state=='block':
                if c=='*' and n=='/': state='code'; i+=1
            i+=1
    return out

def norm(s):
    s=re.sub(r'\s+',' ',s).strip()
    return s

funcs={k:extract_functions(p.read_text(encoding='utf-8')) for k,p in FILES.items()}
common=sorted(set(funcs['reading']) & set(funcs['writing']))
print('READING_FUNCTIONS',len(funcs['reading']))
print('WRITING_FUNCTIONS',len(funcs['writing']))
print('COMMON_FUNCTIONS',len(common))
print('\nCOMMON SIMILARITY')
for name in common:
    a=norm(funcs['reading'][name]); b=norm(funcs['writing'][name])
    ratio=difflib.SequenceMatcher(None,a,b).ratio()
    exact=a==b
    print(f'{name:36} ratio={ratio:.3f} exact={exact} read={len(a)} write={len(b)}')

print('\nREADING_ONLY')
print('\n'.join(sorted(set(funcs['reading'])-set(funcs['writing']))))
print('\nWRITING_ONLY')
print('\n'.join(sorted(set(funcs['writing'])-set(funcs['reading']))))

print('\nHIGH_SIMILARITY_DIFFS')
for name in common:
    a=norm(funcs['reading'][name]); b=norm(funcs['writing'][name])
    ratio=difflib.SequenceMatcher(None,a,b).ratio()
    if ratio>=.82 and a!=b:
        print(f'--- {name} {ratio:.3f}')
        for line in list(difflib.unified_diff(funcs['reading'][name].splitlines(),funcs['writing'][name].splitlines(),fromfile='reading',tofile='writing',n=2))[:80]:
            print(line)

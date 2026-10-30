"""Turn a Civic QA "changes" file (qa_fixes5.json shape) into the gap-fill shape merge_gapfill.py loads.
python3 scripts/civic_changes_to_gapfill.py /workspace/townhall/civic/qa_fixes5.json data/civic/positions_gapfill_batch4.json
Only items whose layer starts with "stances.json" are converted. new=null -> an "unsure" item with override (it replaces
a sourced value; display only, never scored). A numeric new -> a stance (score, verbatim quote, sourceUrl); a "keep" with
a suggestedQuote swaps in that verbatim quote. Research-layer items (e.g. Hilton) are handled in data/civic-exclusions.json.
"""
import json, sys
src, dst = sys.argv[1], sys.argv[2]
C = json.load(open(src))
S = json.load(open('data/stances.json'))['stances']
out = {'_meta': {'from': src, 'asOf': C.get('_meta', {}).get('asOf')}}
for c in C['changes']:
    if not str(c.get('layer', '')).startswith('stances.json'): continue
    cid, iss = c['id'], c['issue']
    name = (C.get(cid) or {}).get('name') or S.get(cid, {}).get('name') or cid
    rec = out.setdefault(cid, {'name': name, 'stances': [], 'unsure': []})
    cur = S.get(cid, {}).get(iss) or {}
    if c.get('new') is None:
        rec['unsure'].append({'issue': iss, 'override': True, 'summary': c.get('why', ''), 'quote': c.get('quote'), 'sourceUrl': c.get('sourceUrl')})
    elif c.get('decision') == 'keep' and not c.get('suggestedQuote'):
        continue
    else:
        q = c.get('suggestedQuote') or c.get('quote')
        x = {'issue': iss, 'score': c['new'], 'quote': q, 'sourceUrl': c.get('sourceUrl') or cur.get('sourceUrl')}
        if cur.get('year'): x['date'] = str(cur['year'])
        rec['stances'].append(x)
json.dump(out, open(dst, 'w'), indent=1, ensure_ascii=False)
print(f"{dst}: {sum(len(v['stances']) for k, v in out.items() if k[0] != '_')} stances, {sum(len(v['unsure']) for k, v in out.items() if k[0] != '_')} unsure")

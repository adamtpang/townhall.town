"""Stance-only loader for Civic gap-fill files (positions_gapfill_batch2.json and later). Idempotent; touches
data/stances.json only (never ballots.json / ny.json, never scripts/merge_research.py).
python3 scripts/merge_gapfill.py [data/civic/positions_gapfill_batch2.json ...]
- "stances" with a numeric nonzero score and a sourceUrl fill or replace that issue (Civic's file wins issue by issue).
- "unsure" items are display only: value stays null, status "unsure", never scored, and never overwrite a sourced value
  unless the item says "override": true (a Civic downgrade; see scripts/civic_changes_to_gapfill.py).
- "sourcesChecked" goes to data/sources-checked.json via scripts/build-sources-checked.mjs (run after this).
"""
import json, sys, glob
files = sys.argv[1:] or sorted(glob.glob('data/civic/positions_gapfill_batch[2-9]*.json'))
S = json.load(open('data/stances.json'))
st = S['stances']
before = sum(1 for c in st.values() for k, v in c.items() if isinstance(v, dict) and isinstance(v.get('value'), (int, float)) and v['value'] != 0)
added = unsure = 0
for f in files:
    G = json.load(open(f))
    for cid, v in G.items():
        if cid.startswith('_') or not isinstance(v, dict) or 'name' not in v: continue  # skip notes blocks (linkFixes, appliesNotes, markets...)
        rec = st.setdefault(cid, {'name': v['name']})
        for x in v.get('stances', []):
            iss = x['issue']
            if not isinstance(x.get('score'), (int, float)) or x['score'] == 0 or not x.get('sourceUrl'): continue
            e = {'value': x['score'], 'quote': x.get('quote') or '', 'sourceUrl': x['sourceUrl']}
            if not x.get('quote') and x.get('summary'): e['summary'] = x['summary']
            if str(x.get('date', ''))[:4].isdigit(): e['year'] = int(str(x['date'])[:4])
            if rec.get(iss) != e: added += 1
            rec[iss] = e
        for x in v.get('unsure', []):
            iss = x['issue']
            cur = rec.get(iss)
            # "override": Civic downgraded a sourced value to unsure (qa_fixes5); otherwise never overwrite a sourced value.
            if cur and isinstance(cur.get('value'), (int, float)) and cur['value'] != 0 and not x.get('override'): continue
            e = {'value': None, 'status': 'unsure', 'summary': x.get('summary', ''), 'sourceUrl': x.get('sourceUrl')}
            if x.get('quote'): e['quote'] = x['quote']
            if cur != e: unsure += 1
            rec[iss] = e
after = sum(1 for c in st.values() for k, v in c.items() if isinstance(v, dict) and isinstance(v.get('value'), (int, float)) and v['value'] != 0)
json.dump(S, open('data/stances.json', 'w'), indent=2, ensure_ascii=False)
print(f'gapfill: {len(files)} file(s); sourced stances {before} -> {after} (+{added} written), unsure {unsure}')

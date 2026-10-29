"""Merge Civic's ballots_additions.json and the 10001 position batches into the repo data. Idempotent.
python3 scripts/merge_civic.py
- Name/title fixes keep the old name as `aka` (photo and track-record lookups fall back to it).
- incumbent null stays unsure ("unsure"), never "not incumbent".
- Races in a split ZIP get dependsOnAddress; TENTATIVE sources get tentative.
- NY judicial races get judicial=true (22 NYCRR 100.5(A)(4)(d)): no overlap is computed for them.
- 10001 stances: merged per issue; null ("No public statement found") entries are dropped, never counted.
"""
import json, re, unicodedata
A = json.load(open('data/civic/ballots_additions.json'))
B = json.load(open('data/ballots.json'))
N = json.load(open('data/ny.json'))
S = json.load(open('data/stances.json'))

def slug(s):
    s = unicodedata.normalize('NFD', s); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', s.lower()))

# Additions that duplicate an existing race (different id, same contest): annotate the existing one instead.
DUP = {'tx-supreme-court-place-2-unexpired': 'tx-supreme-court-place-2', 'tx-sboe-5': 'tx-sboe-5', 'tx-house-49': 'tx-hd-49',
       'tx-15coa-chief': 'tx-15th-coa-chief-justice', 'tx-15coa-place-2': 'tx-15th-coa-place-2', 'tx-15coa-place-3': 'tx-15th-coa-place-3',
       'tx-3coa-chief': 'tx-3rd-coa-chief-justice'}
judicial_races = {v['race'] for v in json.load(open('data/civic/positions_10001_batch4_judicial.json'))['stances'].values()}

def flags(r):
    note = r.get('appliesNote') or ''
    if note.startswith('SPLIT') or note.startswith('unsure'): r['dependsOnAddress'] = True
    if 'TENTATIVE' in note: r['tentative'] = True
    if r['id'] in judicial_races: r['judicial'] = True
    if r.get('office') is None: r['office'] = ''
    for c in r['candidates']:
        if c.get('incumbent') is None: c['incumbent'] = 'unsure'

for z, doc in (('78701', B), ('94103', B), ('10001', N)):
    add, bal = A[z], doc[z]
    for k in ('districts', 'districtSource', 'splitWarning', 'measuresNote'):
        if add.get(k): bal[k] = add[k]
    if add.get('districtSourceUrls'): bal['districtSourceUrls'] = add['districtSourceUrls']
    bal['multiDistrictFlags'] = add.get('multiDistrictFlags') or []
    bal['partyNote'] = add.get('partyNote')
    ids = {r['id']: r for r in bal['races']}
    for r in add['racesToAdd']:
        if r['id'] in DUP and DUP[r['id']] in ids:
            ex = ids[DUP[r['id']]]
            if r.get('appliesNote'): ex['appliesNote'] = r['appliesNote']
            flags(ex); continue
        if r['id'] in ids: ids[r['id']].update({k: v for k, v in r.items() if k == 'appliesNote'}); flags(ids[r['id']]); continue
        r = json.loads(json.dumps(r)); flags(r); bal['races'].append(r); ids[r['id']] = r
    for f in add['fixes']:
        rid = f.get('raceId')
        if not rid or rid not in ids: continue
        r = ids[rid]
        if f['field'] == 'title' and r['title'] in (f['from'], f['to']):
            r.setdefault('akaTitle', f['from']); r['title'] = f['to']; r['titleSource'] = f['source']
        elif f['field'] == 'candidates[].name':
            for c in r['candidates']:
                if c['name'] == f['from']:
                    c['aka'] = f['from']; c['name'] = f['to']; c['nameSource'] = f['source']
    mids = {m['id'] for m in bal.get('measures', [])}
    for m in add.get('measuresToAdd', []):
        if m['id'] not in mids: bal.setdefault('measures', []).append(m)
    for r in bal['races']: flags(r)

# Karen Ortiz: Civic gives the line as "Karen Ortiz (independent line)".
for r in N['10001']['races']:
    for c in r['candidates']:
        if c['name'] == 'Karen Ortiz' and c.get('party') == 'Karen Ortiz Party': c['party'] = 'Karen Ortiz (independent line)'

# nullsRechecked (batch5) is an audit log and is never read or displayed.
# 10001 stances, keyed by the ballot name's slug, merged per issue (later batch wins; null dropped).
ISSUES = {'housing', 'healthcare', 'taxes', 'safety', 'education', 'energy', 'immigration', 'wages', 'infrastructure', 'wealthtax'}
st = S['stances']
for b in ('1', '2', '3', '5'):
    for key, v in json.load(open(f'data/civic/positions_10001_batch{b}.json'))['stances'].items():
        if v.get('judicial'): continue
        sid = slug(v['name']); rec = st.setdefault(sid, {'name': v['name']})
        rec['civicId'] = key
        for iss, x in v.items():
            if iss not in ISSUES or not isinstance(x, dict): continue
            if x.get('value') is not None and x.get('sourceUrl'):
                rec[iss] = {'value': x['value'], 'quote': x.get('quote', ''), 'sourceUrl': x['sourceUrl']}
            elif x.get('value') is None and x.get('status') and (iss not in rec or rec[iss].get('value') is None):
                # Null with a status: shown verbatim, never counted (overlapCore treats null as no position).
                rec[iss] = {'value': None, 'status': x['status'], 'sourceUrl': x.get('sourceUrl') or x.get('checkedUrl')}

# 78701 batches: fill only issues that are still empty; never overwrite an existing value.
HEADING = re.compile(r'^[A-Z0-9 ,.&\'-]+$')  # quote that is only an all-caps page heading
for rec in st.values():
    if slug(rec.get('name', '')) == 'dawn-buckingham':
        for iss, x in list(rec.items()):
            if iss in ISSUES and isinstance(x, dict) and x.get('value') is not None and HEADING.match(x.get('quote', '')):
                rec[iss] = {'value': None, 'status': 'No public statement found', 'sourceUrl': x.get('sourceUrl'), 'headingOnly': True}
tx_judicial = set()
for b in ('1', '2', '3', '4', '5'):
    for key, v in json.load(open(f'data/civic/positions_78701_batch{b}.json'))['stances'].items():
        sid = slug(v['name']); rec = st.setdefault(sid, {'name': v['name']})
        if v.get('judicial') or any(isinstance(x, dict) and x.get('judicial') for x in v.values()): tx_judicial.add(sid)
        for iss, x in v.items():
            if iss not in ISSUES or not isinstance(x, dict): continue
            cur = rec.get(iss)
            empty = cur is None or cur.get('value') is None
            if not empty: continue
            if x.get('value') is not None and x.get('sourceUrl'):
                rec[iss] = {'value': x['value'], 'quote': x.get('quote', ''), 'sourceUrl': x['sourceUrl']}
                if x.get('voteRecord'): rec[iss]['voteRecord'] = x['voteRecord']
            elif x.get('status') and cur is None and not x.get('judicial'):
                rec[iss] = {'value': None, 'status': x['status'], 'sourceUrl': x.get('sourceUrl')}
# Batch 6 is merged LAST and wins issue by issue over batches 1-5 and data/stances.json (incl. real Buckingham
# quotes replacing the heading-only entries). Its _notes are internal and never read into the app.
for key, v in json.load(open('data/civic/positions_78701_batch6.json'))['stances'].items():
    if key.startswith('_') or not isinstance(v, dict) or 'name' not in v: continue
    sid = slug(v['name']); rec = st.setdefault(sid, {'name': v['name']})
    for iss, x in v.items():
        if iss not in ISSUES or not isinstance(x, dict): continue
        if x.get('value') is not None and x.get('sourceUrl'):
            rec[iss] = {'value': x['value'], 'quote': x.get('quote', ''), 'sourceUrl': x['sourceUrl']}
            if x.get('voteRecord'): rec[iss]['voteRecord'] = x['voteRecord']
        elif x.get('status') and (rec.get(iss) is None or rec[iss].get('value') is None):
            rec[iss] = {'value': None, 'status': x['status'], 'sourceUrl': x.get('sourceUrl')}
# 94103 batches 1-3 (built against 2ef3549): fill only, never overwrite an existing entry. Batch 3 is judicial
# retentions: no positions are merged for them and their races get judicial='ca' (no overlap computed).
ca_judicial = set()
sf_names = {slug(c['name']) for r in B['94103']['races'] for c in r['candidates']}
def sf_sid(name):  # Civic drops middle initials ("Malia Cohen" = ballot "Malia M. Cohen"); match first + last word
    sid = slug(name)
    if sid in sf_names: return sid
    w = sid.split('-'); hit = [n for n in sf_names if n.split('-')[0] == w[0] and n.split('-')[-1] == w[-1]]
    return hit[0] if len(hit) == 1 else sid
for b in ('1', '2', '3'):
    for key, v in json.load(open(f'data/civic/positions_94103_batch{b}.json'))['stances'].items():
        sid = sf_sid(v['name'])
        if b == '3': ca_judicial.add(sid); continue
        rec = st.setdefault(sid, {'name': v['name']})
        for iss, x in v.items():
            if iss not in ISSUES or not isinstance(x, dict): continue
            cur = rec.get(iss)
            if cur is not None and cur.get('value') is not None: continue
            if x.get('value') is not None and x.get('sourceUrl'):
                rec[iss] = {'value': x['value'], 'quote': x.get('quote', ''), 'sourceUrl': x['sourceUrl']}
            elif x.get('status') and cur is None:
                rec[iss] = {'value': None, 'status': x['status'], 'sourceUrl': x.get('sourceUrl')}
# 94103 batch 4 is merged LAST for 94103 and wins issue by issue. Recorded-vote entries (quote is the roll-call
# line, note says "vote FOR/AGAINST SB n ..., Mon D, YYYY") keep the vote, bill and year for "Voted Yes on SB 3 (2016)".
VOTE = re.compile(r'vote (FOR|AGAINST) (SB|AB|HR|HB) ?(\d+)\b.*?, ([A-Z][a-z]{2} \d{1,2}, (\d{4}))\s*$')
for key, v in json.load(open('data/civic/positions_94103_batch4.json'))['stances'].items():
    sid = sf_sid(v['name']); rec = st.setdefault(sid, {'name': v['name']})
    for iss, x in v.items():
        if iss not in ISSUES or not isinstance(x, dict): continue
        if x.get('value') is not None and x.get('sourceUrl'):
            rec[iss] = {'value': x['value'], 'quote': x.get('quote', ''), 'sourceUrl': x['sourceUrl']}
            m = VOTE.search(x.get('note', ''))
            if m and 'Recorded vote' in x.get('note', ''):
                rec[iss].update(voteRecord=f"Voted {'Yes' if m.group(1) == 'FOR' else 'No'} ({m.group(4)})", bill=f'{m.group(2)} {m.group(3)}', year=int(m.group(5)))
        elif x.get('status'):
            if rec.get(iss) is None or rec[iss].get('value') is None or x['status'] != 'No public statement found':  # a finding (e.g. mixed statements) wins; a plain no-find does not erase a sourced value
                rec[iss] = {'value': None, 'status': x['status'], 'sourceUrl': x.get('sourceUrl')}
for r in B['94103']['races']:
    if any(slug(c['name']) in ca_judicial for c in r['candidates']) or re.search(r'supreme court|court of appeal|superior court', r['title'], re.I):
        r['judicial'] = 'ca'
# Court races in 78701: no overlap, shown with the Texas judicial line.
for r in B['78701']['races']:
    if r['title'] == 'County Judge': r.pop('judicial', None); continue
    if re.search(r'court|judge|justice|appeals', r['title'], re.I) or any(slug(c['name']) in tx_judicial for c in r['candidates']):
        r['judicial'] = 'tx'
for r in N['10001']['races']:
    if r.get('judicial'): r['judicial'] = 'ny'
# Official titles say "(vote for N)"; we never print that phrase, so it reads "(choose up to N)".
for doc, z in ((B, '78701'), (B, '94103'), (N, '10001')):
    for r in doc[z]['races']: r['title'] = re.sub(r'\(vote for (\d+)\)', r'(choose up to \1)', r['title'], flags=re.I)
S['stances'] = {k: v for k, v in st.items() if any(i in ISSUES for i in v)}

json.dump(B, open('data/ballots.json', 'w'), indent=1, ensure_ascii=False)
json.dump(N, open('data/ny.json', 'w'), indent=1, ensure_ascii=False)
json.dump(S, open('data/stances.json', 'w'), indent=1, ensure_ascii=False)
for z, doc in (('78701', B), ('94103', B), ('10001', N)):
    print(z, len(doc[z]['races']), 'races', len(doc[z].get('measures', [])), 'measures')
print('stances', len(S['stances']))

# 5:33 brief: Bonta safety renders exactly this status (Civic's 17:35 file says "...pending civic review", an internal note).
_d = json.load(open('data/stances.json'))
_b = _d['stances']['rob-bonta']
if _b.get('safety', {}).get('value') is None:
    _b['safety'] = {"value": None, "status": "Mixed statements; no clear position from a valid source", "sourceUrl": None}
    json.dump(_d, open('data/stances.json', 'w'), indent=2, ensure_ascii=False)

# Adam 5:47: internal 'Pending: …' statuses are never shown to voters. Value stays null (never counted).
_d = json.load(open('data/stances.json'))
_n = 0
for _c in _d['stances'].values():
    for _k, _v in _c.items():
        if isinstance(_v, dict) and _v.get('value') is None and str(_v.get('status', '')).lower().startswith('pending'):
            _v['status'] = 'Still being sourced'; _v['sourceUrl'] = None; _v.pop('quote', None); _n += 1
json.dump(_d, open('data/stances.json', 'w'), indent=2, ensure_ascii=False)
print('pending->still being sourced', _n)

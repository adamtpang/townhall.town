"""Year for each sourced quote, from the source's own date. python3 scripts/quote_years.py -> data/quote_years.json
Basis, in order: a date in the source URL path; the page's published-date metadata (article:published_time,
datePublished, <time datetime>); on Ballotpedia, the nearest heading above the quote that names a year
(e.g. "2022 campaign themes"; Ballotpedia often refuses automated fetches, so those stay undated); an official .gov
release dateline (home pages are never dated this way); Civic's batch notes. No basis found = no year shown (the UI says 'date unsure')."""
import json, re, subprocess, html, unicodedata
S = json.load(open('data/stances.json'))['stances']
OVERRIDE = {  # from Civic positions_78701_batch6 notes (internal; text not displayed)
    'dawn-buckingham.healthcare': (2016, 'Civic: 2016 campaign site, via Ballotpedia'),
    'bo-french.education': (2016, 'Civic: 2016 campaign site, via Ballotpedia'),
}
cache = {}
def page(u):
    if u not in cache:
        r = subprocess.run(['curl', '-sL', '-m', '20', '-A', 'Mozilla/5.0 (townhall civic data)', u], capture_output=True)
        cache[u] = r.stdout.decode('utf-8', 'ignore')
    return cache[u]
norm = lambda t: re.sub(r'\W+', ' ', unicodedata.normalize('NFKD', html.unescape(t)).lower()).strip()
def year_for(url, quote):
    m = re.search(r'/(20[0-2]\d)/(0[1-9]|1[0-2])/', url) or re.search(r'[/-](20[0-2]\d)-(0[1-9]|1[0-2])-\d\d', url)
    if m: return int(m.group(1)), 'date in source URL'
    m = re.search(r'media\.api\.sf\.gov/documents/N(2\d)_', url)
    if m: return 2000 + int(m.group(1)), 'SF Voter Information Pamphlet edition in URL'
    m = re.search(r'(?:growsf\.org/voter-guide/questionnaires/[a-z]+-|sfgreens\.org/questionnaires/)(20[0-2]\d)\b', url)
    if m: return int(m.group(1)), 'questionnaire year in URL'
    h = page(url.split('#')[0])
    if not h: return None
    if 'ballotpedia.org' in url:
        q = norm(quote)[:50]
        txt = re.sub(r'<(script|style).*?</\1>', ' ', h, flags=re.S)
        parts = re.split(r'(<h[1-5][^>]*>.*?</h[1-5]>)', txt, flags=re.S)
        last = None
        for p in parts:
            if re.match(r'<h[1-5]', p):
                y = re.search(r'\b(20[0-2]\d)\b', re.sub(r'<[^>]+>', '', p))
                if y: last = int(y.group(1))
            elif q and q in norm(re.sub(r'<[^>]+>', ' ', p)):
                return (last, 'Ballotpedia section heading') if last else None
        return None
    if re.fullmatch(r'https?://[^/]+/?', url.split('#')[0].split('?')[0]):
        return None  # a site's home page is a living page; its creation date is not the quote's date
    for pat in [r'article:published_time"\s+content="(20\d\d)', r'"datePublished"\s*:\s*"(20\d\d)', r'<time[^>]+datetime="(20\d\d)', r'name="(?:date|pubdate|publish-date)"\s+content="(20\d\d)']:
        m = re.search(pat, h)
        if m: return int(m.group(1)), 'page published date'
    if re.search(r'\.gov/', url) and re.search(r'/(news|press|releases?)/', url):  # official release dateline
        m = re.search(r'(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, (20[0-2]\d)', re.sub(r'<[^>]+>', ' ', h))
        if m: return int(m.group(1)), 'press release dateline'
    return None
out = {}
for sid, v in S.items():
    for iss, x in v.items():
        if not isinstance(x, dict) or x.get('value') is None or not x.get('quote'): continue
        k = f'{sid}.{iss}'
        r = OVERRIDE.get(k) or year_for(x['sourceUrl'], x['quote'])
        if r: out[k] = {'year': r[0], 'basis': r[1]}
json.dump({'note': __doc__.strip(), 'years': out}, open('data/quote_years.json', 'w'), indent=1)
print(len(out), 'quotes dated')

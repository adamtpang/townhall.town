"""Merge the research data layer (/workspace/townhall/data) into the app's data files.
Outputs: data/ballots.json (4 demo ZIPs, enriched) and data/tx.json (statewide + 38 House races + ZIP->CD for any TX ZIP)."""
import json, re, os, sys
from urllib.parse import unquote
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RD = os.environ.get("RESEARCH_DATA", "/workspace/townhall/data")
MEDIA = os.environ.get("CAND_MEDIA", "/workspace/townhall/site/data/raw/cand_media.json")
J = lambda p: json.load(open(p))
PARTY = {"D": "Democratic", "R": "Republican", "L": "Libertarian", "G": "Green", "I": "Independent"}
TOPICS = {
    "housing": r"\b(housing|rents?|renters?|homeowners?|home prices|affordable homes|homelessness)\b",
    "healthcare": r"\b(health ?care|health insurance|medicaid|medicare|uninsured|hospitals?|ACA)\b",
    "jobs": r"\b(jobs?|wages?|workers?|employment|unemploy\w*|paychecks?)\b",
}
BOILER = re.compile(r"(See also: Ballotpedia|Candidate Connection|Ballotpedia reserves|Who fills out|Help improve Ballotpedia|has not yet completed|did not complete|survey questions appear|campaign website stated the following|click here)", re.I)
media = J(MEDIA) if os.path.exists(MEDIA) else {}

def media_key(url):
    slug = url.rstrip("/").split("/")[-1]
    raw = unquote(slug).encode("utf-8")
    return "".join(chr(b) if (chr(b).isalnum() and b < 128) or chr(b) == "_" else "_" for b in raw)

def positions(c):
    sp = c.get("stated_positions") or {}
    text, src = sp.get("text") or "", sp.get("source") or c.get("ballotpedia")
    lines = [l.strip() for l in text.split("\n") if l.strip() and not BOILER.search(l)]
    out = []
    for topic, rx in TOPICS.items():
        for l in lines:
            m = re.search(rx, l, re.I)
            if not m:
                continue
            sents = re.split(r"(?<=[.!?])\s+", l)
            s = next((x for x in sents if re.search(rx, x, re.I)), l)
            out.append({"issue": topic, "text": s[:320] + ("…" if len(s) > 320 else ""), "match": "keyword match in verbatim campaign themes", "source": {"label": "Ballotpedia campaign themes (verbatim)", "url": src}})
            break
    return out, bool(lines)

def politician(c, state, federal):
    k = media_key(c["ballotpedia"]) if c.get("ballotpedia") else None
    md = media.get(k, {}) if k else {}
    xs = md.get("x") or {}
    x = xs.get("Campaign X") or xs.get("Official X") or xs.get("Personal X")
    pos, has_themes = positions(c)
    fec = c.get("fec")
    if federal:
        fin = {"label": "FEC: " + fec["candidate_id"] + " (name match, verify)", "url": fec["url"]} if fec else {"label": "FEC search", "url": "https://www.fec.gov/data/candidates/?search=" + c["name"].replace(" ", "%20")}
    elif state == "TX":
        fin = {"label": "Texas Ethics Commission search", "url": "https://www.ethics.state.tx.us/search/cf/"}
    else:
        fin = {"label": "Cal-Access search", "url": "https://cal-access.sos.ca.gov/Campaign/Candidates/"}
    p = {
        "name": c["name"],
        "party": PARTY.get(c.get("party"), c.get("party")),
        "incumbent": bool(c.get("incumbent")),
        "incumbentSource": c.get("incumbent_source"),
        "ballotpedia": c.get("ballotpedia"),
        "officialSite": c.get("official_website"),
        "campaignSite": c.get("campaign_website"),
        "x": x,
        "photo": {"url": md["photo"], "credit": "Photo via Ballotpedia", "license": "see Ballotpedia page"} if md.get("photo") else None,
        "finance": fin,
        "positions": pos,
        "hasThemes": has_themes,
    }
    if c["name"] == "Donald Huffines":
        p["incumbentNote"] = "Sitting Comptroller: Gov. Abbott appointed Huffines after Kelly Hancock (R) resigned; Hancock had lost the Mar 3 GOP primary to Huffines (Ballotpedia; comptroller.texas.gov lists Huffines)."
    return p

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

TXID = {"U.S. Senate Texas": "us-senate-tx", "Governor of Texas": "tx-gov", "Lieutenant Governor of Texas": "tx-ltgov", "Attorney General of Texas": "tx-ag",
        "Texas Comptroller of Public Accounts": "tx-comptroller", "Texas Land Commissioner": "tx-land", "Texas Commissioner of Agriculture": "tx-agcomm", "Texas Railroad Commission": "tx-rrc"}

def race(r, state, rid):
    federal = r.get("office_key", "").startswith("us_")
    return {
        "id": rid, "title": r["race"], "level": "federal" if federal else "state",
        "office": r.get("what_it_controls") or "unsure", "officeSource": r.get("what_it_controls_source"),
        "candidates": [politician(c, state, federal) for c in r["candidates"]], "source": r["source"],
    }

tx_state = [race(r, "TX", TXID.get(r["race"], "tx-" + slug(r["race"].replace("Texas ", "")))) for r in J(f"{RD}/texas/statewide_races.json")["races"]]
tx_house = {str(r["district"]): race(r, "TX", f"tx-{r['district']}") for r in J(f"{RD}/texas/us_house_races.json")["races"]}
zip_to_cd = J(f"{RD}/texas/zip_to_congressional_district.json")["zip_to_cd"]

ballots = J(f"{ROOT}/data/ballots.json")
ca_old_ids = {r["title"]: r["id"] for r in ballots["94103"]["races"]}
ca_state = [race(r, "CA", ca_old_ids.get(r["race"], "ca-" + slug(r["race"]))) for r in J(f"{RD}/california/statewide_races.json")["races"]]
ca_house = {str(r["district"]): race(r, "CA", f"ca-{r['district']}") for r in J(f"{RD}/california/us_house_races_demo.json")["races"]}

for z, b in ballots.items():
    house = [tx_house[d["id"].split("-")[1]] if b["state"] == "TX" else ca_house[d["id"].split("-")[1]] for d in b["districts"]]
    b["races"] = house + (tx_state if b["state"] == "TX" else ca_state)
    # problems -> shared contract shape (value string, source object); numeric kept as extra fields
    for p in b.get("problems") or []:
        if isinstance(p.get("source"), str):
            p["numeric"] = p["value"]; p["value"] = f"{p['value']}{p.get('unit','')}"
            p["source"] = {"label": f"Census ACS {p.get('table','')} via Census Reporter", "url": p["source"]}
json.dump(ballots, open(f"{ROOT}/data/ballots.json", "w"), indent=1, ensure_ascii=False)
json.dump({"statewide": tx_state, "house": tx_house, "zipToCd": zip_to_cd,
           "zipSource": {"label": "ZIP centroid (Census 2024 ZCTA Gazetteer) in PLANC2333 (Texas Legislative Council)", "url": "https://data.capitol.texas.gov/dataset/planc2333"}},
          open(f"{ROOT}/data/tx.json", "w"), ensure_ascii=False)
n = sum(len(r["candidates"]) for r in tx_state) + sum(len(r["candidates"]) for r in tx_house.values())
print("tx statewide", len(tx_state), "house", len(tx_house), "zips", len(zip_to_cd), "cands", n)
allc = [c for r in tx_state + list(tx_house.values()) + ca_state + list(ca_house.values()) for c in r["candidates"]]
print("photos", sum(1 for c in allc if c["photo"]), "/", len(allc), "x", sum(1 for c in allc if c["x"]), "positions>0", sum(1 for c in allc if c["positions"]))

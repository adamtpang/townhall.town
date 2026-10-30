"""Reorder candidates to the official sample-ballot order in data/civic/ballot_order_check.json (Civic, Oct 30 2026).
Data-only: touches candidate order in data/ballots.json, data/tx.json and data/ny.json, nothing else. Idempotent.
Only races with an official_order (MATCH / MISMATCH) are touched; UNCONFIRMED races keep their order.
Usage: python3 scripts/apply-ballot-order.py"""
import json, re, unicodedata

def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def bare(n):  # "Ken Paxton (REP)" -> "Ken Paxton"; keeps inner parentheses like "Donald P. (Don) Wagner"
    return re.sub(r"\s*\([^()]*\)\s*$", "", n)

checks = json.load(open("data/civic/ballot_order_check.json"))
want = {}
for r in checks:
    if r.get("official_order"):
        want[(r["zip"], r["race_id"])] = [norm(bare(n)) for n in r["official_order"]]

changed = []
def reorder(zip_, race, where):
    key = (zip_, race["id"])
    if key not in want and zip_ == "TX":
        key = ("78701", race["id"])  # tx.json statewide/house copies of the same Travis-ballot races
    if key not in want: return
    order = want[key]
    by = {norm(c["name"]): c for c in race["candidates"]}
    if sorted(by) != sorted(order):  # same person, middle initial only on one side ("Lauren Peña" / "Lauren B. Peña")
        ends = lambda n: (n.split()[0], n.split()[-1])
        alias = {o: [k for k in by if ends(k) == ends(o)] for o in order}
        if all(len(v) == 1 for v in alias.values()) and len({v[0] for v in alias.values()}) == len(by) == len(order):
            by = {o: by[v[0]] for o, v in alias.items()}
    if sorted(by) != sorted(order):
        raise SystemExit(f"{where} {race['id']}: names differ {sorted(by)} vs {sorted(order)}")
    before = [c["name"] for c in race["candidates"]]
    race["candidates"] = [by[n] for n in order]
    after = [c["name"] for c in race["candidates"]]
    if before != after: changed.append((where, race["id"], before, after))

b = json.load(open("data/ballots.json"))
for r in b["78701"]["races"]: reorder("78701", r, "ballots.json 78701")
json.dump(b, open("data/ballots.json", "w"), indent=1, ensure_ascii=False)

ny = json.load(open("data/ny.json"))
for r in ny["10001"]["races"]: reorder("10001", r, "ny.json 10001")
json.dump(ny, open("data/ny.json", "w"), indent=1, ensure_ascii=False)

tx = json.load(open("data/tx.json"))
for r in tx["statewide"]: reorder("TX", r, "tx.json statewide")
for cd, r in tx["house"].items():
    if r and r.get("id") in ("tx-10", "tx-37"): reorder("TX", r, f"tx.json house {cd}")
json.dump(tx, open("data/tx.json", "w"), ensure_ascii=False)

for w, rid, a, z in changed: print(f"{w} {rid}\n  before: {', '.join(a)}\n  after:  {', '.join(z)}")
print(len(changed), "races reordered")

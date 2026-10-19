"""Build data/cards.json for the MHC collection site.

Reads a Collection export (JSON from the Google Sheets API: {"values": [[header...], [row...]]})
plus the Top 100 ranking, keeps PUBLIC fields only (no cost, dates, platform or notes),
and lists which photos exist under img/cards/<Card ID>/.

Usage: python3 tools/build_data.py collection.json top100.json [--tags "Lindor SSP Run"] [--sports "Football,Hockey"] [--ids MHC-0001,...] [--only-with-photos]
Filters are a union (any match keeps the card).
"""
import json, os, re, sys, argparse

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PSA_NAMES = {"10": "GEM MT", "9": "MINT", "8": "NM-MT", "7": "NM", "6": "EX-MT", "5": "EX",
             "4": "VG-EX", "3": "VG", "2": "GOOD", "1.5": "FAIR", "1": "PR"}
PUBLIC = ["Card ID", "Sport", "Grade", "Cert #", "Player Name", "Team", "Year", "Set",
          "Variation", "Print Run", "Card #", "Category", "Date Purchased"]  # date only, never cost/platform/notes
OPTIONAL = ["RC", "Serial #"]  # used automatically once these columns exist in the tracker


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_grade(g):
    g = (g or "").strip()
    if not g or g.lower() == "raw":
        return None
    if re.search(r"auth", g, re.I):  # e.g. "PSA Authentic": authenticated, no number grade
        grader = g.split()[0].upper()
        return {"grader": grader, "value": "A", "label": "AUTHENTIC"}
    m = re.match(r"([A-Za-z]+)\s*([\d.]+)", g)
    if not m:
        return {"grader": g, "value": "", "label": g}
    grader, val = m.group(1).upper(), m.group(2)
    label = PSA_NAMES.get(val, "") if grader == "PSA" else ""
    return {"grader": grader, "value": val, "label": label}


def parse_date(s):
    """Tracker dates arrive as M/D/YYYY or MM-DD-YYYY. Returns ISO YYYY-MM-DD or None."""
    m = re.match(r"^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*$", s or "")
    if not m:
        m2 = re.match(r"^\s*(\d{4})-(\d{2})-(\d{2})", s or "")
        return f"{m2.group(1)}-{m2.group(2)}-{m2.group(3)}" if m2 else None
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"


def photos_for(cid):
    d = os.path.join(SITE, "img", "cards", cid)
    out = {}
    for kind in ("front", "back"):
        if os.path.exists(os.path.join(d, f"{kind}.jpg")):
            out[kind] = f"img/cards/{cid}/{kind}.jpg"
            if os.path.exists(os.path.join(d, f"{kind}-thumb.jpg")):
                out[kind + "Thumb"] = f"img/cards/{cid}/{kind}-thumb.jpg"
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("collection"); ap.add_argument("top100")
    ap.add_argument("--tags", default="")
    ap.add_argument("--ids", default="")
    ap.add_argument("--sports", default="")
    ap.add_argument("--only-with-photos", action="store_true")
    a = ap.parse_args()

    v = json.load(open(a.collection))["values"]
    head = v[0]
    idx = {h: head.index(h) for h in PUBLIC + OPTIONAL if h in head}
    ranks = {}
    for r in json.load(open(a.top100))["values"]:
        if len(r) >= 2 and r[0].isdigit() and r[1].startswith("MHC"):
            ranks[r[1]] = int(r[0])

    want_tags = {t.strip() for t in a.tags.split(",") if t.strip()}
    want_ids = {t.strip() for t in a.ids.split(",") if t.strip()}
    want_sports = {t.strip().lower() for t in a.sports.split(",") if t.strip()}
    cards = []
    for r in v[1:]:
        if not r or not r[0].startswith("MHC"):
            continue
        r = r + [""] * (len(head) - len(r))
        f = lambda k: r[idx[k]].strip() if k in idx else ""
        tags = [t.strip() for t in f("Category").split(",") if t.strip()]
        cid = f("Card ID")
        # filters are a union: a card is kept if it matches any tag, id or sport given
        if want_tags or want_ids or want_sports:
            if not ((want_tags & set(tags)) or cid in want_ids or f("Sport").lower() in want_sports):
                continue
        pr = f("Print Run")
        var = f("Variation")
        ssp = pr.upper() == "SSP" or bool(re.search(r"\bSSP\b", var))
        numbered = pr.isdigit()
        serial = f("Serial #")
        photos = photos_for(cid)
        if a.only_with_photos and "front" not in photos:
            continue
        cards.append({
            "id": cid,
            "sport": f("Sport"),
            "player": f("Player Name"),
            "team": f("Team"),
            "year": f("Year"),
            "set": f("Set"),
            "variation": re.sub(r"\s+-\s+", " · ", var),
            "cardNo": f("Card #"),
            "printRun": int(pr) if numbered else None,
            "serial": int(serial) if serial.isdigit() else None,
            "ssp": ssp,
            "rc": f("RC").upper() in ("TRUE", "YES", "Y", "RC"),
            "grade": parse_grade(f("Grade")),
            "cert": f("Cert #") or None,
            "tags": tags,
            "top100": ranks.get(cid),
            "acquired": parse_date(f("Date Purchased")),
            "photos": photos,
        })
    out = {"generated": __import__("datetime").date.today().isoformat(), "cards": cards}
    json.dump(out, open(os.path.join(SITE, "data", "cards.json"), "w"), indent=1)
    print(f"wrote {len(cards)} cards")


if __name__ == "__main__":
    main()

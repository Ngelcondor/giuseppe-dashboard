"""
Transaction categorisation engine.

Single source of truth for mapping a transaction (merchant + description, with an
optional MCC) onto a budget category. Tuned for Giuseppe's real spending —
Barcelona/Spain + Italy merchants, plus his recurring subscriptions — so the
"Spese per categoria" panel buckets things meaningfully instead of dumping
everything into "Altro".

Used by CSV import, bank sync, and the recategorise endpoint so every code path
classifies identically.
"""
from __future__ import annotations

# Merchant-category-code → category. High confidence, checked before keywords.
MCC_CATEGORY_MAP: dict[str, str] = {
    "5411": "Alimentari", "5412": "Alimentari", "5422": "Alimentari",
    "5451": "Alimentari", "5499": "Alimentari",
    "5541": "Trasporti", "5542": "Trasporti", "4111": "Trasporti",
    "4121": "Trasporti", "4131": "Trasporti", "4789": "Trasporti", "7523": "Trasporti",
    "4511": "Viaggi", "4582": "Viaggi", "7011": "Viaggi",
    "5812": "Ristorazione", "5813": "Ristorazione", "5814": "Ristorazione",
    "5045": "Tech", "5732": "Tech", "5734": "Tech", "5735": "Tech",
    "8011": "Salute", "8021": "Salute", "8031": "Salute", "8042": "Salute",
    "8049": "Salute", "8099": "Salute", "5912": "Salute",
    "5944": "Shopping", "5621": "Shopping", "5641": "Shopping", "5651": "Shopping",
    "5661": "Shopping", "5691": "Shopping", "5699": "Shopping",
    "7832": "Svago", "7922": "Svago", "7941": "Svago", "7991": "Svago", "7996": "Svago",
    "4814": "Bollette", "4899": "Bollette", "4900": "Bollette",
    "6011": "Prelievi",
}

# Ordered keyword rules — first match wins, so specific/subscription rules come
# before broad ones. Matched against "<merchant> <description>" lowercased.
KEYWORD_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("Abbonamenti", (
        "spotify", "netflix", "disney", "hbo", "prime video", "amazon prime",
        "youtube premium", "youtube music", "apple.com/bill", "apple music",
        "icloud", "google one", "google storage", "openai", "chatgpt",
        "anthropic", "claude.ai", "claude", "cursor", "github", "notion",
        "adobe", "dropbox", "1password", "proton", "nordvpn", "expressvpn",
        "audible", "patreon", "midjourney", "perplexity", "x premium",
    )),
    ("Studio", (
        "hack the box", "hackthebox", "htb", "offensive security", "offsec",
        "tryhackme", "udemy", "coursera", "uoc", "universitat", "pluralsight",
        "o'reilly", "oreilly", "leanpub", "kindle", "libreria", "llibreria",
    )),
    ("Casa", (
        "affitto", "alquiler", "lloguer", "loyer", "inmobiliaria", "ikea",
        "leroy merlin", "bricodepot", "brico depot", "ferreteria", "comunidad",
        "administracion finca",
    )),
    ("Bollette", (
        "endesa", "iberdrola", "naturgy", "holaluz", "repsol luz", "totalenergies",
        "aigues", "agbar", "gas natural", "enel", "vodafone", "movistar",
        "orange", "yoigo", "masmovil", "digi", "pepephone", "lowi", "jazztel",
        "iliad", "fastweb", "fibra", "bolletta",
    )),
    ("Alimentari", (
        "mercadona", "carrefour", "lidl", "aldi", "consum", "bonpreu", "esclat",
        "caprabo", "condis", "ametller", "supermercat", "supermercado",
        "supermercato", "grocery", "alimentari", "fruteria", "panaderia",
        "eroski", "alcampo", "esselunga", "conad", "carniceria", "dia%",
    )),
    ("Ristorazione", (
        "restaurant", "restaurante", "ristorante", "cafeteria", "mcdonald",
        "burger king", "kfc", "telepizza", "domino", "pizza", "kebab", "sushi",
        "starbucks", "glovo", "uber eats", "ubereats", "just eat", "justeat",
        "deliveroo", "braseria", "taberna", "tapas", "cerveceria", "vermuteria",
    )),
    ("Trasporti", (
        "renfe", "rodalies", "tmb", "metro", "fgc", "autobus", "cercanias",
        "trenitalia", "italo", "uber", "bolt", "cabify", "free now", "taxi",
        "bicing", "parking", "aparcamiento", "gasolinera", "repsol", "cepsa",
        "galp", "peaje", "autopista", "aena", "vueling", "ryanair", "easyjet",
        "iberia", "flixbus",
    )),
    ("Salute", (
        "farmacia", "parafarmacia", "pharmacy", "clinica", "hospital", "dentista",
        "dentist", "psicolog", "psiquiatr", "optica", "fisioterapia", "laboratorio",
    )),
    ("Tech", (
        "amazon", "aliexpress", "pccomponentes", "mediamarkt", "media markt",
        "fnac", "apple store", "el corte ingles", "worten", "k-tuin", "ktuin",
        "keychron", "logitech", "anker",
    )),
    ("Shopping", (
        "zara", "h&m", "uniqlo", "pull&bear", "bershka", "stradivarius", "mango",
        "primark", "decathlon", "nike", "adidas", "asos", "shein", "springfield",
        "massimo dutti", "douglas", "sephora", "muji",
    )),
    ("Svago", (
        "cinema", "cinesa", "yelmo", "teatro", "concierto", "concert", "steam",
        "playstation", "nintendo", "xbox", "epic games", "gimnasio", "basic fit",
        "basic-fit", "metropolitan", "padel", "museo", "museu",
    )),
    ("Prelievi", ("atm", "cajero", "withdrawal", "prelievo", "bancomat")),
    ("Commissioni", ("fee", "comision", "commissione", "comissio")),
]


def categorize(
    description: str | None = None,
    merchant: str | None = None,
    mcc: str | None = None,
    *,
    is_income: bool = False,
) -> str:
    """Best-guess budget category for a transaction.

    Income is always grouped as "Entrate" (the spending breakdown only counts
    expenses, so income categories are never split). For expenses, MCC wins when
    present and known; otherwise keyword-match merchant + description, falling
    back to "Altro".
    """
    if is_income:
        return "Entrate"

    if mcc:
        hit = MCC_CATEGORY_MAP.get(mcc.strip())
        if hit:
            return hit

    haystack = f"{merchant or ''} {description or ''}".lower()
    for category, keywords in KEYWORD_RULES:
        if any(kw in haystack for kw in keywords):
            return category

    return "Altro"

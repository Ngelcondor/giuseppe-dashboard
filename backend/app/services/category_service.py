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
    # Named payees (both name orders, since transfers vary surname-first).
    ("420", ("giulio de angelis", "de angelis giulio")),
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
        "dendros", "cristina moro", "moro cristina", "giovanni oriolo", "oriolo giovanni",
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

# Buy-now-pay-later / consumer-credit providers — always financing, so these win
# on their own.
_BNPL_PROVIDERS = (
    "klarna", "scalapay", "sequra", "clearpay", "afterpay", "cofidis",
    "findomestic", "younited", "oney", "floa", "agos", "compass",
)
# Installment / loan markers. Combined with PayPal (or seen on their own) they
# mean a rata/prestito rather than a normal purchase.
_INSTALLMENT_MARKERS = (
    "ratenzahlung", "ratenkauf", "rateizz", "paga in 3", "paga in 4",
    "pago en 3", "pago en 4", "en 3 plazos", "en 4 plazos", "installment",
    "prestito", "prestamo", "finanziamento", "financiacion", "credito al consumo",
)

# Brand prefixes that sell far more than subscriptions — for these, only the full
# subscription title (e.g. "amazon prime") is matched, never the bare brand, so a
# one-off Amazon order doesn't get tagged as a subscription.
_GENERIC_BRANDS = {"amazon", "apple", "google", "microsoft", "paypal", "samsung"}


def subscription_keywords(titles: list[str] | None) -> set[str]:
    """Turn the user's subscription titles into match phrases.

    Keeps the full normalised title (so "Amazon Prime" matches only Prime) and,
    for non-generic brands, the leading word too (so "Spotify Premium" still
    matches a "SPOTIFY P3..." charge). Mirrors the dedicated Abbonamenti page so
    categorisation stays in sync with it.
    """
    kws: set[str] = set()
    for title in titles or []:
        n = " ".join((title or "").lower().split())
        if len(n) < 4:
            continue
        kws.add(n)
        first = n.split()[0]
        if len(first) >= 4 and first not in _GENERIC_BRANDS:
            kws.add(first)
    return kws


def categorize(
    description: str | None = None,
    merchant: str | None = None,
    mcc: str | None = None,
    *,
    is_income: bool = False,
    sub_keywords: set[str] | None = None,
) -> str:
    """Best-guess budget category for a transaction.

    Income is always grouped as "Entrate" (the spending breakdown only counts
    expenses, so income categories are never split). For expenses: a match
    against the user's own subscriptions wins first (keeps "Abbonamenti" aligned
    with the dedicated page), then MCC, then keyword rules, else "Altro".
    """
    if is_income:
        return "Entrate"

    haystack = f"{merchant or ''} {description or ''}".lower()

    if sub_keywords and any(kw in haystack for kw in sub_keywords):
        return "Abbonamenti"

    if mcc:
        hit = MCC_CATEGORY_MAP.get(mcc.strip())
        if hit:
            return hit

    for category, keywords in KEYWORD_RULES:
        if any(kw in haystack for kw in keywords):
            return category

    # Financing: BNPL providers, explicit installment/loan markers, or a PayPal
    # charge with no identifiable merchant (Giuseppe's PayPal flow is rate/loans).
    # Checked last so a recognised merchant paid via PayPal still wins.
    if (
        any(p in haystack for p in _BNPL_PROVIDERS)
        or any(m in haystack for m in _INSTALLMENT_MARKERS)
        or "paypal" in haystack
    ):
        return "Rate"

    return "Altro"

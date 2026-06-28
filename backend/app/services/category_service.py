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

# Category for OUTGOING internal movements — giroconti / transfers to own
# pockets. Per Giuseppe: these are NOT spending, so the dashboard excludes them
# from the Uscite total (rows still show in the ledger). Incoming transfers
# (money from his pockets, parents, sales, top-ups) DO count as Entrate, so the
# is_income short-circuit runs before this check.
TRANSFER_CATEGORY = "Trasferimenti"

# Description fallback for outgoing transfers when bank_category is absent (e.g.
# CSV import). The trailing currency codes carry a leading space so "to eur"
# never matches inside an unrelated word.
_TRANSFER_MARKERS = (
    "to eur", "to usd", "to gbp", "to chf", "to pln", "to ron",
    "exchanged to", "to revolut", "savings vault",
)

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
    # Named payees (descriptions often truncate to "To Giulio D").
    ("420", ("giulio de angelis", "de angelis giulio", "giulio d")),
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
        "administracion finca", "giardiniere",
    )),
    ("Bollette", (
        "endesa", "iberdrola", "naturgy", "holaluz", "repsol luz", "totalenergies",
        "aigues", "agbar", "gas natural", "energia", "enel", "vodafone", "movistar",
        "orange", "yoigo", "masmovil", "digi", "pepephone", "lowi", "jazztel",
        "iliad", "fastweb", "fibra", "bolletta",
    )),
    ("Alimentari", (
        "mercadona", "carrefour", "carref", "lidl", "aldi", "consum", "bonpreu",
        "esclat", "caprabo", "condis", "ametller", "supermercat", "supermercado",
        "supermercato", "grocery", "alimentari", "fruteria", "panaderia",
        "eroski", "alcampo", "esselunga", "conad", "carniceria", "casa italia",
    )),
    ("Ristorazione", (
        "restaurant", "restaurante", "ristorante", "cafeteria", "mcdonald",
        "burger king", "kfc", "telepizza", "domino", "pizza", "kebab", "sushi",
        "starbucks", "glovo", "uber eats", "ubereats", "just eat", "justeat",
        "deliveroo", "braseria", "taberna", "tapas", "cerveceria", "vermuteria",
        "brunch",
    )),
    ("Trasporti", (
        "renfe", "rodalies", "tmb", "metro", "fgc", "autobus", "cercanias",
        "trenitalia", "italo", "uber", "bolt", "cabify", "free now", "taxi",
        "bicing", "parking", "parquing", "aparcamiento", "gasolinera", "repsol",
        "cepsa", "galp", "peaje", "autopista", "aena", "vueling", "ryanair",
        "easyjet", "iberia", "flixbus", "itv ", "autolavado",
    )),
    ("Salute", (
        "farmacia", "parafarmacia", "pharmacy", "clinica", "hospital", "dentista",
        "dentist", "psicolog", "psiquiatr", "optica", "fisioterapia", "laboratorio",
        "endocrinolog", "dendros", "cristina moro", "moro cristina",
        "giovanni oriolo", "oriolo giovanni",
    )),
    ("Tech", (
        "amazon", "aliexpress", "pccomponentes", "mediamarkt", "media markt",
        "fnac", "apple store", "apple.com", "el corte ingles", "worten",
        "k-tuin", "ktuin", "keychron", "logitech", "anker",
    )),
    ("Shopping", (
        "zara", "h&m", "uniqlo", "pull&bear", "bershka", "stradivarius", "mango",
        "primark", "decathlon", "nike", "adidas", "asos", "shein", "springfield",
        "massimo dutti", "douglas", "sephora", "muji", "lush", "vinted",
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
    "wandoo", "quebueno",
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
    bank_category: str | None = None,
) -> str:
    """Best-guess budget category for a transaction.

    All income is grouped as "Entrate" and always counts (pocket transfers,
    parents, sales, top-ups). For expenses the order is: subscriptions →
    keyword rules (named payees like 420, rent→Casa, merchants) → MCC → outgoing
    transfers (giroconti → "Trasferimenti", excluded from Uscite) → financing
    (Rate) → "Varie". Keyword rules run BEFORE the transfer check so a meaningful
    P2P payment (rent, 420) wins over the generic giroconto exclusion.
    """
    if is_income:
        return "Entrate"

    haystack = f"{merchant or ''} {description or ''}".lower()

    if sub_keywords and any(kw in haystack for kw in sub_keywords):
        return "Abbonamenti"

    for category, keywords in KEYWORD_RULES:
        if any(kw in haystack for kw in keywords):
            return category

    if mcc:
        hit = MCC_CATEGORY_MAP.get(mcc.strip())
        if hit:
            return hit

    # Outgoing internal movement (giroconto / transfer to own pockets) → not
    # spending. After the keyword rules so named payees keep their category.
    if (bank_category or "").upper() == "TRANSFER" or any(kw in haystack for kw in _TRANSFER_MARKERS):
        return TRANSFER_CATEGORY

    # Financing: BNPL/loan providers, installment markers, or a PayPal charge with
    # no identifiable merchant (Giuseppe's PayPal flow is rate/loans).
    if (
        any(p in haystack for p in _BNPL_PROVIDERS)
        or any(m in haystack for m in _INSTALLMENT_MARKERS)
        or "paypal" in haystack
    ):
        return "Rate"

    return "Varie"

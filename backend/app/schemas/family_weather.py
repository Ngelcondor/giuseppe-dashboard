"""Family weather schemas — meteo reale (Open-Meteo) per le città dei familiari."""
from pydantic import BaseModel
from typing import Optional


class FamilyWeatherItem(BaseModel):
    """Una location/membro con meteo corrente reale.

    I campi meteo sono Optional: se Open-Meteo non risponde restano None e il
    frontend mostra un placeholder, mai valori inventati.
    """
    label: str       # es. "mamma", "papà", "Aurora"
    city: str        # es. "Bergamo"
    temp: Optional[int] = None   # temperatura corrente °C (arrotondata)
    code: Optional[int] = None   # WMO weather code
    min: Optional[int] = None    # minima di oggi °C
    max: Optional[int] = None    # massima di oggi °C

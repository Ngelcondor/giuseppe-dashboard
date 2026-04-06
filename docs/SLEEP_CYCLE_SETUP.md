# Integrazione Sleep Cycle via iOS Shortcut

Sleep Cycle non ha un'API pubblica, ma scrive tutti i dati sonno in Apple HealthKit.
Questa guida spiega come creare uno Shortcut iOS che legge i dati HealthKit (scritti da Sleep Cycle) e li invia alla dashboard.

## Prerequisiti

1. **Sleep Cycle** installato e configurato per scrivere su Apple Salute
2. **Dashboard backend** deployato con `APPLE_HEALTH_WEBHOOK_SECRET` configurato nel `.env`
3. iPhone con iOS 16+ e app **Comandi Rapidi**

## Come funziona

```
Sleep Cycle → scrive in HealthKit → Shortcut iOS legge HealthKit → POST al webhook → Dashboard
```

Lo Shortcut gira automaticamente ogni mattina (o manualmente) e invia i dati della notte precedente.

## Configurazione Sleep Cycle

1. Apri **Sleep Cycle** → Impostazioni → **Apple Salute**
2. Abilita tutte le categorie:
   - Analisi del sonno (fasi)
   - Frequenza cardiaca
   - Russamento
   - Qualità del sonno

## Creare lo Shortcut iOS

### Step 1: Nuovo Shortcut
Apri **Comandi Rapidi** → `+` → Rinomina in "Sync Sleep Cycle"

### Step 2: Azioni dello Shortcut

Aggiungi queste azioni in ordine:

#### 2a. Leggi dati sonno da HealthKit
```
Azione: "Trova campioni di Salute"
  Tipo: Analisi del sonno
  Raggruppa per: Giorno
  Ordina per: Data fine (più recente prima)
  Limite: 1
```

#### 2b. Estrai i tempi
```
Azione: "Ottieni dettagli del campione di Salute"
  Dettaglio: Data inizio → Salva in variabile "sleep_start"
  Dettaglio: Data fine → Salva in variabile "sleep_end"
  Dettaglio: Valore → Salva in variabile "duration"
```

#### 2c. Leggi frequenza cardiaca minima notturna
```
Azione: "Trova campioni di Salute"
  Tipo: Frequenza cardiaca
  Data inizio: maggiore di → variabile "sleep_start"
  Data fine: minore di → variabile "sleep_end"
  Ordina per: Valore (crescente)
  Limite: 1
→ Salva valore in "hr_lowest"
```

#### 2d. Leggi fasi del sonno (iOS 16+)
HealthKit su iOS 16+ espone le fasi come sottocampioni dell'analisi del sonno:
```
Azione: "Trova campioni di Salute"
  Tipo: Analisi del sonno
  Sottotipo: Ciascun campione (non raggruppato)
  Data inizio: maggiore di → variabile "sleep_start"
  Data fine: minore di → variabile "sleep_end"
```

Per ogni fase, calcola la durata in minuti e accumula per tipo:
- `HKCategoryValueSleepAnalysis.asleepDeep` → deep_minutes
- `HKCategoryValueSleepAnalysis.asleepREM` → rem_minutes
- `HKCategoryValueSleepAnalysis.asleepCore` → light_minutes
- `HKCategoryValueSleepAnalysis.awake` → awake_minutes

#### 2e. Costruisci il JSON payload
```
Azione: "Dizionario"
{
  "sleep_start": sleep_start (formato ISO),
  "sleep_end": sleep_end (formato ISO),
  "duration_minutes": (differenza in minuti),
  "time_in_bed_minutes": (differenza totale incluso tempo sveglio),
  "awake_minutes": awake_minutes,
  "light_minutes": light_minutes,
  "deep_minutes": deep_minutes,
  "rem_minutes": rem_minutes,
  "heart_rate_lowest": hr_lowest,
  "sc_quality_score": null,
  "snoring_minutes": null,
  "mood_on_wake": null,
  "notes": null
}
```

> **Nota su sc_quality_score e snoring:** Sleep Cycle non espone questi dati in HealthKit.
> Per includerli, puoi usare "Chiedi input" nello Shortcut per inserirli manualmente dopo il risveglio,
> oppure lasciarli `null` e la dashboard calcolerà un quality score interno basato sulle fasi.

#### 2f. Invia al webhook
```
Azione: "Ottieni contenuti dell'URL"
  URL: https://TUO-DOMINIO/api/v1/health/sleep/sync/sleep-cycle
  Metodo: POST
  Intestazioni:
    Authorization: Bearer IL_TUO_WEBHOOK_SECRET
    Content-Type: application/json
  Corpo richiesta: JSON → il dizionario creato sopra
```

### Step 3: Automazione

Per far girare lo Shortcut automaticamente ogni mattina:

1. **Comandi Rapidi** → **Automazione** → `+`
2. **Ora del giorno** → 08:00 (o quando ti svegli di solito)
3. **Esegui immediatamente** (senza chiedere conferma)
4. Seleziona lo Shortcut "Sync Sleep Cycle"

Oppure con trigger **Sveglia disattivata**:
1. Automazione → Sveglia → "Quando viene interrotta"
2. Esegui lo Shortcut "Sync Sleep Cycle"

## Endpoint API

### POST `/api/v1/health/sleep/sync/sleep-cycle`

**Headers:**
```
Authorization: Bearer YOUR_WEBHOOK_SECRET
Content-Type: application/json
```

**Body:**
```json
{
  "sleep_start": "2026-04-06T23:30:00+02:00",
  "sleep_end": "2026-04-07T07:15:00+02:00",
  "duration_minutes": 420,
  "time_in_bed_minutes": 465,
  "awake_minutes": 15,
  "light_minutes": 195,
  "deep_minutes": 90,
  "rem_minutes": 120,
  "sc_quality_score": 82,
  "snoring_minutes": 12,
  "regularity_score": 75,
  "sleep_aid_used": "rain",
  "alarm_mode": "smart",
  "wake_up_mood": "good",
  "heart_rate_lowest": 52,
  "steps_to_sleep": 8,
  "mood_on_wake": "good",
  "notes": "Dormito bene",
  "phases": [
    {
      "phase": "light",
      "start_time": "2026-04-06T23:30:00+02:00",
      "end_time": "2026-04-07T00:15:00+02:00",
      "duration_minutes": 45
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "session_id": "uuid",
  "imported": true,
  "skipped": false,
  "reason": null,
  "synced_at": "2026-04-07T06:15:00Z"
}
```

### GET `/api/v1/health/sleep/sync/sleep-cycle/status`

Controlla lo stato della sync (non richiede auth):
```json
{
  "connected": true,
  "total_sessions": 42,
  "last_sync": "2026-04-07T06:15:00"
}
```

## Deduplicazione

Il webhook è idempotente: se esiste già una sessione con `sleep_start` entro ±5 minuti, i dati Sleep Cycle-specifici vengono aggiornati sulla sessione esistente (utile se hai già i dati da Apple Health webhook).

## Dati opzionali con input manuale

Per arricchire i dati con informazioni che HealthKit non espone, puoi aggiungere allo Shortcut delle azioni "Chiedi input" dopo il risveglio:

- **SC Quality Score**: "Qual era il punteggio qualità di Sleep Cycle?" (apri l'app e leggi)
- **Snoring minutes**: "Minuti di russamento da Sleep Cycle?"
- **Mood**: menu a scelta "Come ti senti?" → great/good/okay/bad/terrible
- **Sleep aid**: "Quale suono hai usato?" → rain/white_noise/none

Questi campi sono tutti opzionali: la dashboard funziona anche senza.

## Test

Puoi testare l'endpoint con curl:

```bash
curl -X POST https://TUO-DOMINIO/api/v1/health/sleep/sync/sleep-cycle \
  -H "Authorization: Bearer IL_TUO_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "sleep_start": "2026-04-05T23:30:00+02:00",
    "sleep_end": "2026-04-06T07:00:00+02:00",
    "duration_minutes": 420,
    "awake_minutes": 15,
    "light_minutes": 195,
    "deep_minutes": 90,
    "rem_minutes": 120,
    "heart_rate_lowest": 54
  }'
```

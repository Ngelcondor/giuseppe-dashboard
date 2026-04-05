# Configurazione Sincronizzazione Apple Health

Questa guida spiega come configurare la sincronizzazione automatica dei dati da Apple Health al tuo Giuseppe Dashboard.

## Panoramica dei Metodi

Abbiamo 2 metodi disponibili:

1. **iOS Shortcuts (Gratuito)** - Automatizzazione nativa di iOS
2. **Health Auto Export App** - App dedicata da App Store

Consigliamo il Metodo 1 per la maggior parte degli utenti in quanto completamente gratuito e affidabile.

---

## Metodo 1: iOS Shortcuts (Consigliato)

### Prerequisiti
- iPhone o iPad con iOS 13+
- App Shortcuts installata
- Giuseppe Dashboard in esecuzione online
- URL accessibile pubblicamente (es: https://dashboard.tuodominio.com)

### Step 1: Genera un Token API

1. Accedi al tuo dashboard all'indirizzo http://localhost:3000 (o il tuo dominio)
2. Vai a Impostazioni > Integrazioni
3. Clicca "Genera Token API per Health Sync"
4. Copia il token (esempio: `ghd_1a2b3c4d5e6f7890abcdef`)
5. Salva in un luogo sicuro

### Step 2: Crea l'Automazione iOS Shortcuts

#### Sottostep 2a: Apri l'App Shortcuts

1. Su iPhone, apri l'app **Shortcuts**
2. Vai al tab **Automazioni** in basso
3. Clicca il bottone **+** per creare una nuova automazione

#### Sottostep 2b: Configura il Trigger

1. Seleziona **Ora del Giorno** (per sincronizzazione giornaliera)
   - Oppure scegli **Wi-Fi Connesso** per sincronizzare quando il dispositivo si connette al Wi-Fi
2. Se hai scelto "Ora del Giorno":
   - Imposta l'ora desiderata (es: 22:00 ogni sera)
   - Clicca **Avanti**
3. Seleziona **Non chiedere quando si esegue**
4. Clicca **Avanti**

#### Sottostep 2c: Aggiungi le Azioni

Ora aggiungi le azioni per leggere i dati da Apple Health:

**Azione 1: Ottieni Passi di Oggi**
1. Clicca **Aggiungi Azione**
2. Cerca "Salute" o "Health"
3. Seleziona **Ottieni Conteggio Passi**
4. Imposta "Intervallo di Date" a **Oggi**
5. Clicca **Fatto**

**Azione 2: Ottieni Calorie Attive**
1. Clicca il **+** per aggiungere un'altra azione
2. Cerca "Salute"
3. Seleziona **Ottieni Calorie Attive**
4. Imposta "Intervallo di Date" a **Oggi**

**Azione 3: Ottieni Distanza Percorsa**
1. Aggiungi un'altra azione Salute
2. Seleziona **Ottieni Distanza Percorsa**
3. Imposta "Intervallo di Date" a **Oggi**

**Azione 4: Ottieni Frequenza Cardiaca**
1. Aggiungi un'altra azione Salute
2. Seleziona **Ottieni Frequenza Cardiaca Media**
3. Imposta "Intervallo di Date" a **Oggi**

**Azione 5: Ottieni Minuti di Esercizio**
1. Aggiungi un'altra azione Salute
2. Seleziona **Ottieni Minuti di Esercizio**
3. Imposta "Intervallo di Date" a **Oggi**

#### Sottostep 2d: Prepara i Dati

Aggiungi un'azione "Testo" per formattare i dati in JSON:

1. Clicca **Aggiungi Azione**
2. Cerca "Testo"
3. Seleziona **Testo**
4. Incolla questo contenuto:

```json
{
  "auth_token": "INSERISCI_IL_TUO_TOKEN_QUI",
  "data": [
    {
      "type": "steps",
      "value": [valore_passi],
      "unit": "count",
      "recorded_at": "[data_ora_attuale]",
      "source": "Apple Health"
    },
    {
      "type": "active_calories",
      "value": [valore_calorie],
      "unit": "kcal",
      "recorded_at": "[data_ora_attuale]",
      "source": "Apple Health"
    },
    {
      "type": "distance",
      "value": [valore_distanza],
      "unit": "km",
      "recorded_at": "[data_ora_attuale]",
      "source": "Apple Health"
    },
    {
      "type": "heart_rate",
      "value": [valore_bpm],
      "unit": "bpm",
      "recorded_at": "[data_ora_attuale]",
      "source": "Apple Health"
    },
    {
      "type": "exercise_time",
      "value": [valore_minuti],
      "unit": "minutes",
      "recorded_at": "[data_ora_attuale]",
      "source": "Apple Health"
    }
  ]
}
```

5. Sostituisci `INSERISCI_IL_TUO_TOKEN_QUI` con il token che hai generato al Step 1

#### Sottostep 2e: Invia i Dati

1. Clicca **Aggiungi Azione**
2. Cerca "Richiesta HTTP" o "URL"
3. Seleziona **Richiesta HTTP**
4. Configura:
   - **Metodo**: POST
   - **URL**: `https://dashboard.tuodominio.com/api/v1/health/import`
   - **Headers**:
     - Content-Type: application/json
   - **Body**: [Il testo JSON che hai creato sopra]
5. Clicca **Avanti**

#### Sottostep 2f: Notifiche (Opzionale)

Per ricevere una notifica al termine:

1. Clicca **Aggiungi Azione**
2. Cerca "Notifica"
3. Seleziona **Mostra Risultato**
4. Digita: "Dati salute sincronizzati con successo ✓"
5. Clicca **Fine**

### Step 3: Testa la Configurazione

1. Esegui manualmente lo shortcut toccando il bottone **Play**
2. Controlla nel dashboard se i dati sono stati ricevuti
3. Verifica nei log se ci sono errori:
   ```bash
   docker-compose -f docker/docker-compose.yml logs -f backend | grep -i health
   ```

### Step 4: Abilita l'Automazione

1. Assicurati che l'automazione sia **abilitata** (interruttore verde)
2. Esci da Shortcuts - le automazioni funzionano in background
3. I dati si sincronizzeranno automaticamente all'ora impostata

### Troubleshooting Metodo 1

**Problem: "Richiesta non riuscita" o "Errore di connessione"**
- Verifica che il dominio sia raggiungibile da internet
- Controlla che HTTPS sia abilitato
- Verifica i firewall e il port forwarding
- Prova a disabilitare VPN temporaneamente

**Problem: "Errore 401 Non Autorizzato"**
- Il token potrebbe essere scaduto o errato
- Genera un nuovo token dal dashboard
- Assicurati di aver copiato l'intero token senza spazi

**Problem: "Errore 400 Bad Request"**
- Il formato JSON potrebbe essere errato
- Verifica di aver mantenuto la formattazione corretta
- I nomi dei campi devono essere esattamente come specificato

**Problem: La sincronizzazione non avviene**
- Verifica che il dispositivo sia connesso a Wi-Fi (se usi questo trigger)
- Controlla le impostazioni di batteria risparmio che potrebbero bloccare le automazioni
- Assicurati che l'app Shortcuts abbia permessi di accesso a Apple Health

---

## Metodo 2: Health Auto Export App

### Vantaggi
- Interfaccia grafica semplice
- Non richiede configurazione manuale di JSON
- Sincronizzazione affidabile in background

### Svantaggi
- App a pagamento su App Store (~€2-4)
- Meno flessibile di iOS Shortcuts

### Setup

1. Scarica **Health Auto Export** da App Store
2. Apri l'app e configura:
   - **Seleziona i dati**: Steps, Calories, Distance, Heart Rate, Sleep, Workouts
   - **Frequenza sincronizzazione**: Giornaliera o ogni 6 ore
   - **Formato**: JSON
   - **Endpoint URL**: `https://tuodominio.com/api/v1/health/import`
   - **Headers**: Aggiungi `Authorization: Bearer YOUR_TOKEN`
3. Concedi i permessi di accesso ad Apple Health
4. Abilita le sincronizzazioni automatiche
5. Testa con un sync manuale

---

## Formato Dati API

Quando invii i dati al tuo dashboard, usa questo formato:

```json
{
  "auth_token": "ghd_1a2b3c4d5e6f7890abcdef",
  "data": [
    {
      "type": "steps",
      "value": 8234,
      "unit": "count",
      "recorded_at": "2024-03-28T23:59:59Z",
      "source": "Apple Health"
    },
    {
      "type": "active_calories",
      "value": 456.5,
      "unit": "kcal",
      "recorded_at": "2024-03-28T23:59:59Z",
      "source": "Apple Health"
    }
  ]
}
```

### Tipi di Dati Supportati

| Tipo | Unit | Esempio |
|------|------|---------|
| `steps` | count | 8234 |
| `distance` | km o m | 5.2 |
| `active_calories` | kcal | 456 |
| `heart_rate` | bpm | 72 |
| `heart_rate_variability` | ms | 45 |
| `resting_heart_rate` | bpm | 60 |
| `sleep` | minutes | 480 |
| `sleep_deep` | minutes | 120 |
| `sleep_rem` | minutes | 100 |
| `sleep_core` | minutes | 260 |
| `workout_duration` | minutes | 45 |
| `workout_calories` | kcal | 350 |
| `water_consumption` | ml | 500 |
| `caffeine` | mg | 95 |
| `blood_pressure_systolic` | mmHg | 120 |
| `blood_pressure_diastolic` | mmHg | 80 |
| `blood_glucose` | mg/dL | 110 |
| `body_weight` | kg o lbs | 75.5 |
| `body_fat` | percent | 22 |

---

## Endpoint API per Health Import

### POST /api/v1/health/import

Importa dati salute da Apple Health o altre sorgenti.

**Autenticazione**: Token JWT o Auth Token

**Request Body**:
```json
{
  "auth_token": "ghd_1a2b3c4d5e6f7890abcdef",
  "data": [
    {
      "type": "steps",
      "value": 8234,
      "unit": "count",
      "recorded_at": "2024-03-28T10:30:00Z",
      "source": "Apple Health"
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "1 health data entries imported successfully",
  "imported_count": 1,
  "failed_count": 0,
  "entries": [
    {
      "id": "uuid",
      "type": "steps",
      "value": 8234,
      "recorded_at": "2024-03-28T10:30:00Z",
      "created_at": "2024-03-28T15:30:00Z"
    }
  ]
}
```

**Status Codes**:
- `200`: Import riuscito
- `400`: Dati non validi
- `401`: Autenticazione fallita
- `422`: Validazione fallita
- `500`: Errore server

---

## Datastore e Retention Policy

Il dashboard memorizza i dati importati per:

- **Dati salute**: 2 anni
- **Attività**: 5 anni
- **Obiettivi completati**: 5 anni
- **Integrazione logs**: 90 giorni

### Esportare i Dati

Per scaricare tutti i tuoi dati:

1. Vai a Impostazioni > Privacy
2. Clicca "Scarica i Miei Dati"
3. Riceverai un file ZIP con tutti i dati in formato JSON e CSV

---

## Privacy e Sicurezza

- I tuoi dati non vengono mai condivisi con terze parti
- I token API hanno scadenza (configurabile)
- Puoi revocare i token in qualsiasi momento
- Tutti i dati sono criptati in transito (HTTPS)
- I dati a riposo sono protetti nel database
- Puoi eliminare i dati in qualsiasi momento

---

## Sincronizzazione Manuale

Se preferisci non usare automazioni:

```bash
curl -X POST https://dashboard.tuodominio.com/api/v1/health/import \
  -H "Content-Type: application/json" \
  -d '{
    "auth_token": "ghd_1a2b3c4d5e6f7890abcdef",
    "data": [{
      "type": "steps",
      "value": 8234,
      "unit": "count",
      "recorded_at": "2024-03-28T10:30:00Z"
    }]
  }'
```

---

## Monitoraggio della Sincronizzazione

Nel dashboard:

1. Vai a Impostazioni > Integrazione Apple Health
2. Visualizza:
   - Ultima sincronizzazione: data/ora
   - Numero totale di dati importati
   - Status ultimo import
   - Errori (se presenti)

---

## FAQ

**D: Quante volte al giorno posso sincronizzare?**
R: Non c'è limite tecnico, ma consigliamo 1-2 volte al giorno per non sovraccaricare il server. Le automazioni iOS hanno naturalmente un limite minimo di esecuzione.

**D: I dati vengono sincronizzati retroattivamente?**
R: Sì, puoi importare dati storici specificando una data passata nel campo `recorded_at`.

**D: Cosa succede se il server non è raggiungibile durante una sincronizzazione?**
R: Dipende dal metodo:
- **Shortcuts**: La richiesta fallisce ma il shortcut lo ripeterà al trigger successivo
- **Health Auto Export**: Di solito riprova automaticamente entro 24 ore

**D: Posso usare lo stesso token su più dispositivi?**
R: Sì, lo stesso token funziona su tutti i dispositivi. Se vuoi revocare l'accesso a un dispositivo, genera un nuovo token.

**D: I dati duplicati come vengono gestiti?**
R: Il sistema rileva i duplicati basandosi su (tipo, valore, data) e li deduplica automaticamente entro 5 minuti da ultimi dati ricevuti.

**D: Come faccio a sapere se la sincronizzazione è avvenuta con successo?**
R: Nel dashboard vedrai una notifica e potrai controllare il log in Impostazioni. Inoltre, puoi controllare i log del server:
```bash
docker-compose -f docker/docker-compose.yml logs backend | grep -i "health.*import"
```

---

## Support

Per problemi:
1. Controlla la sezione Troubleshooting sopra
2. Verifica i log del server
3. Apri un issue su GitHub con screenshot degli errori
4. Contatta il supporto via email

**Ultima modifica**: 2024-03-28

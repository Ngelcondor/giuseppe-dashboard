# Giuseppe Dashboard

Una dashboard personale completa per monitorare salute, attività fisica, dati meteo e obiettivi personali con sincronizzazione automatica da Apple Health.

## Caratteristiche Principali

- **Dashboard Personalizzata**: Visualizza tutti i tuoi dati in un'unica schermata intuitiva
- **Sincronizzazione Apple Health**: Importa automaticamente dati da Apple Health su iOS
- **Monitoraggio della Salute**: Frequenza cardiaca, passi, calorie, sonno e altro
- **Tracking Attività**: Registra e monitora attività fisiche con durata, distanze e calorie
- **Dati Meteo**: Visualizza le condizioni meteo attuali e prossime
- **Gestione Obiettivi**: Imposta e monitora i tuoi obiettivi personali
- **Integrazione API**: Connetti facilmente altre app e servizi
- **Tema Scuro/Chiaro**: Scegli il tema che preferisci
- **Responsive Design**: Perfetto su desktop, tablet e mobile
- **Autenticazione Sicura**: JWT-based authentication
- **API REST Completa**: Documentazione OpenAPI su `/docs` (solo in development — disabilitata in production)

## Stack Tecnologico

### Backend
- **FastAPI**: Framework Python moderno e veloce
- **PostgreSQL**: Database relazionale robusto
- **Redis**: Caching e code queue
- **Celery**: Task scheduling e background jobs
- **SQLAlchemy**: ORM per il database
- **Pydantic**: Validazione dati

### Frontend
- **Next.js**: React framework per produzione
- **TypeScript**: Type safety
- **TailwindCSS**: Styling utility-first
- **React Query**: State management e data fetching
- **Chart.js/Recharts**: Visualizzazione dati

### DevOps
- **Docker & Docker Compose**: Containerizzazione
- **Nginx**: Reverse proxy
- **Let's Encrypt**: SSL/TLS

## Prerequisiti

- Docker (versione 20.10+)
- Docker Compose (versione 2.0+)
- Git
- (Opzionale) Apple Watch o iPhone per la sincronizzazione dati

## Quick Start

### 1. Clone del Repository
```bash
git clone https://github.com/tuousername/giuseppe-dashboard.git
cd giuseppe-dashboard
```

### 2. Configurazione dell'Ambiente
```bash
cp docker/.env.example docker/.env
# Modifica il file docker/.env con i tuoi dati
nano docker/.env
```

### 3. Avvia i Servizi
```bash
docker-compose -f docker/docker-compose.yml up -d
```

### 4. Accedi all'Applicazione
- **Frontend**: http://localhost:3000
- **API Docs** (solo development): http://localhost:8000/docs
- **ReDoc** (solo development): http://localhost:8000/redoc

## Setup Iniziale

### Crea il primo utente admin
```bash
docker-compose -f docker/docker-compose.yml exec backend python -m app.cli create-admin \
  --username admin \
  --email admin@example.com \
  --password your-secure-password
```

### Carica dati di esempio (opzionale)
```bash
docker-compose -f docker/docker-compose.yml exec backend python -m app.cli load-sample-data
```

## Development Setup

Per sviluppare localmente senza Docker:

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env .
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp ../.env.local .
npm run dev
```

### Avvia Celery Worker (in un altro terminale)
```bash
cd backend
source venv/bin/activate
celery -A tasks worker --loglevel=info
```

### Avvia Celery Beat (in un altro terminale)
```bash
cd backend
source venv/bin/activate
celery -A tasks beat --loglevel=info
```

## Variabili d'Ambiente

Vedi `docker/.env.example` per una lista completa. Le variabili più importanti:

```
DATABASE_URL              # Connessione PostgreSQL
REDIS_URL                 # Connessione Redis
SECRET_KEY                # Chiave segreta per JWT (CAMBIA IN PRODUZIONE!)
JWT_EXPIRY_MINUTES        # Validità token (default: 30 min)
WEATHER_API_KEY           # Chiave OpenWeatherMap API
NEXT_PUBLIC_API_URL       # URL API backend per frontend
```

## Apple Health Sync Setup

Vedi la guida dettagliata in [`docs/APPLE_HEALTH_SETUP.md`](docs/APPLE_HEALTH_SETUP.md)

### Metodo Rapido con iOS Shortcuts

1. Apri l'app Shortcuts su iPhone
2. Crea una nuova automazione: Tempo > Giornalmente
3. Aggiungi un'azione HTTP POST a `https://tuo-dominio.com/api/v1/health/import`
4. Formato payload:
```json
{
  "data": [
    {
      "type": "steps",
      "value": 8234,
      "unit": "count",
      "recorded_at": "2024-03-28T10:30:00Z"
    }
  ],
  "auth_token": "your-api-token"
}
```

## Struttura del Progetto

```
giuseppe-dashboard/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── health.py
│   │   │   │   ├── activities.py
│   │   │   │   ├── goals.py
│   │   │   │   └── integrations.py
│   │   │   └── dependencies.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── health.py
│   │   │   └── activity.py
│   │   ├── schemas/
│   │   │   └── (Pydantic models)
│   │   ├── database.py
│   │   ├── config.py
│   │   └── cli.py
│   ├── tasks/
│   │   ├── health_sync.py
│   │   ├── weather.py
│   │   └── notifications.py
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── pages/
│   │   ├── dashboard/
│   │   ├── health/
│   │   ├── activities/
│   │   ├── goals/
│   │   └── settings/
│   ├── components/
│   │   ├── common/
│   │   ├── charts/
│   │   └── widgets/
│   ├── hooks/
│   ├── types/
│   ├── styles/
│   └── package.json
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── nginx.conf
│   ├── init.sql
│   └── .env.example
├── docs/
│   ├── APPLE_HEALTH_SETUP.md
│   ├── HOSTING_GUIDE.md
│   ├── API.md
│   └── DATABASE.md
└── README.md
```

## Comandi Docker Utili

```bash
# Avvia tutti i servizi
docker-compose -f docker/docker-compose.yml up -d

# Visualizza i log
docker-compose -f docker/docker-compose.yml logs -f

# Ferma i servizi
docker-compose -f docker/docker-compose.yml down

# Riavvia un servizio specifico
docker-compose -f docker/docker-compose.yml restart backend

# Accedi al terminale PostgreSQL
docker-compose -f docker/docker-compose.yml exec postgres psql -U dashboard -d dashboard

# Esegui migrazioni database
docker-compose -f docker/docker-compose.yml exec backend alembic upgrade head

# Visualizza variabili d'ambiente
docker-compose -f docker/docker-compose.yml exec backend env
```

## API Endpoints

### Autenticazione
- `POST /api/v1/auth/register` - Registrazione
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

### Dati Salute
- `GET /api/v1/health` - Ottieni tutti i dati
- `POST /api/v1/health` - Aggiungi nuovo dato
- `POST /api/v1/health/import` - Importa da Apple Health
- `GET /api/v1/health/stats` - Statistiche e metriche

### Attività
- `GET /api/v1/activities` - Lista attività
- `POST /api/v1/activities` - Crea attività
- `GET /api/v1/activities/{id}` - Dettagli attività
- `PUT /api/v1/activities/{id}` - Modifica attività
- `DELETE /api/v1/activities/{id}` - Elimina attività

### Obiettivi
- `GET /api/v1/goals` - Lista obiettivi
- `POST /api/v1/goals` - Crea obiettivo
- `PUT /api/v1/goals/{id}` - Modifica obiettivo
- `DELETE /api/v1/goals/{id}` - Elimina obiettivo

Documentazione OpenAPI: http://localhost:8000/docs (solo in development — disabilitata in production, vedi sezione [Security](#security))

## Hosting e Deploy

Vedi [`docs/HOSTING_GUIDE.md`](docs/HOSTING_GUIDE.md) per guide dettagliate su:
- Oracle Cloud Free Tier
- Hetzner VPS
- Home server con Cloudflare Tunnel
- SSL con Let's Encrypt
- Configurazione Firewall
- Best practices di sicurezza

## Troubleshooting

### I servizi non si avviano
```bash
# Controlla i log
docker-compose -f docker/docker-compose.yml logs

# Elimina i volumi e ricrea
docker-compose -f docker/docker-compose.yml down -v
docker-compose -f docker/docker-compose.yml up -d
```

### Errore di connessione al database
- Verifica che PostgreSQL sia in esecuzione: `docker ps`
- Controlla le credenziali nel file `.env`
- Verifica la salute del servizio: `docker-compose -f docker/docker-compose.yml ps`

### Apple Health non sincronizza
- Verifica la chiave API e il token in `.env`
- Controlla i log: `docker-compose -f docker/docker-compose.yml logs celery-worker`
- Vedi `docs/APPLE_HEALTH_SETUP.md` per la risoluzione dei problemi

### Problema di performance
- Aumenta i worker Gunicorn: `GUNICORN_WORKERS=4`
- Abilita il caching Redis
- Ottimizza le query del database
- Verifica l'uso di memoria: `docker stats`

## Sicurezza

- Cambia `SECRET_KEY` in produzione con una stringa casuale forte
- Usa HTTPS in produzione (certificati Let's Encrypt)
- Configura le variabili d'ambiente sensibili in modo sicuro
- Non committare `.env` in git (usa `.env.example`)
- Abilita `SECURE_SSL_REDIRECT=true` in produzione
- Usa password forti per il database
- Configura il firewall correttamente
- Abilita i backup automatici del database

## Security

Procedure operative di hardening per il deployment in produzione.

### Bootstrap iniziale dell'admin

L'endpoint `POST /api/v1/auth/init` è disabilitato di default in produzione
(`ALLOW_ADMIN_INIT=false`). Per il primo setup:

1. Setta temporaneamente `ALLOW_ADMIN_INIT=true` nel file env di produzione
2. Riavvia il backend
3. Chiama `POST /api/v1/auth/init` una sola volta per creare l'admin
4. Rimetti `ALLOW_ADMIN_INIT=false` e riavvia il backend

L'endpoint è idempotente: se un admin esiste già, ritorna 403 anche con il flag
attivo. Ogni tentativo di init viene loggato come `warning` con l'IP del client.

### API docs disabilitati in produzione

`/docs`, `/redoc` e `/openapi.json` sono disattivati quando
`DISABLE_DOCS=true` o `ENVIRONMENT=production`, per evitare information
disclosure dello schema API. In sviluppo restano accessibili.

### Schemi di autenticazione

Coesistono due schemi distinti:

- **OAuth2 Password Bearer** (token JWT): per tutti gli endpoint utente
  (`/scadenze`, `/habits-api`, `/mood-api`, `/health/sleep`, `/study`, ecc.).
- **HTTPBearer** con secret fisso (`APPLE_HEALTH_WEBHOOK_SECRET`): solo per i
  webhook chiamati da iOS Shortcuts (`/health/sleep/sync/*`). Non confondere i
  due token — gli Shortcuts NON devono usare JWT.

### TLS / HTTPS

Il dominio di produzione (`dashboard.elcondor.dev`) usa Let's Encrypt via
`certbot` installato sull'host. Il `docker-compose.prod.yml` monta i cert da
`/etc/letsencrypt/live/dashboard.elcondor.dev/` dentro il container nginx.
Setup iniziale:

```sh
sudo apt install -y certbot
docker compose -f docker/docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d dashboard.elcondor.dev \
  --email your@email --agree-tos -n
docker compose -f docker/docker-compose.prod.yml up -d nginx
```

Auto-renewal via crontab (Let's Encrypt cert dura 90 giorni):

```sh
sudo crontab -e
# 0 3 * * * certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f /home/giuseppe/apps/giuseppe-dashboard/docker/docker-compose.prod.yml exec nginx nginx -s reload
```

`nginx.conf` redirige tutto HTTP (80) → HTTPS (443), imposta HSTS un anno,
e una baseline CSP.

## Contributing

Le contribuzioni sono benvenute! Per favore:

1. Fork il repository
2. Crea un branch per la tua feature (`git checkout -b feature/amazing-feature`)
3. Commit le tue modifiche (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Apri una Pull Request

## Testing

```bash
# Backend
docker-compose -f docker/docker-compose.yml exec backend pytest

# Frontend
docker-compose -f docker/docker-compose.yml exec frontend npm test

# Coverage
docker-compose -f docker/docker-compose.yml exec backend pytest --cov=app
```

## Performance e Monitoring

- Health check endpoint: `GET /health`
- Metrics Prometheus: `GET /metrics` (opzionale)
- Database monitoring: `EXPLAIN ANALYZE` per query lente
- Caching headers ottimizzati per asset statici
- Compression gzip abilitato per le risposte

## Roadmap

- [ ] Integrazione Telegram per notifiche
- [ ] Esportazione dati in PDF
- [ ] Grafici avanzati e analisi predittive
- [ ] Mobile app nativa
- [ ] Sincronizzazione multi-device
- [ ] Condivisione dati con medici
- [ ] AI-powered health insights
- [ ] Integrazione con più wearables

## License

Questo progetto è distribuito sotto la licenza MIT. Vedi il file [`LICENSE`](LICENSE) per dettagli.

## Supporto

Per problemi e domande:
- Apri un issue su GitHub
- Leggi la documentazione nella cartella [`docs/`](docs/)
- Consulta i log Docker per errori specifici
- Contatta l'autore via email

---

Creato con ❤️ da [Giuseppe Diana]

**Ultime modifiche**: 2024-03-28

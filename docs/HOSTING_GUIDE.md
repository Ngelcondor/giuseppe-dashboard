# Guida al Hosting e Deploy in Produzione

Questa guida copre come deployare Giuseppe Dashboard su server pubblici con varie opzioni di hosting.

## Indice
1. [Prerequisiti Generali](#prerequisiti-generali)
2. [Opzione 1: Oracle Cloud Free Tier](#opzione-1-oracle-cloud-free-tier)
3. [Opzione 2: Hetzner VPS](#opzione-2-hetzner-vps)
4. [Opzione 3: Home Server + Cloudflare Tunnel](#opzione-3-home-server--cloudflare-tunnel)
5. [SSL/TLS con Let's Encrypt](#ssltls-con-lets-encrypt)
6. [Configurazione Domain](#configurazione-domain)
7. [Hardening di Sicurezza](#hardening-di-sicurezza)
8. [Backup e Recovery](#backup-e-recovery)
9. [Monitoring e Logging](#monitoring-e-logging)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisiti Generali

### Conoscenze Richieste
- Comandi Linux base
- SSH e SCP
- Docker e Docker Compose
- Concetti di networking (firewall, porte, DNS)

### Strumenti Necessari
- Git
- SSH client (OpenSSH)
- Docker (versione 20.10+)
- Docker Compose (versione 2.0+)
- Certbot (Let's Encrypt)

### Controllo Versioni
```bash
docker --version    # Docker 20.10+
docker-compose --version  # 2.0+
git --version       # Qualunque versione recente
```

---

## Opzione 1: Oracle Cloud Free Tier

Oracle Cloud offre 2 istanze VM sempre gratuite + 1 database PostgreSQL.

### Step 1: Crea Account e Istanza

1. Vai su oracle.com/cloud/free
2. Crea account gratuito
3. Nel Cloud Console:
   - Menu > Compute > Instances
   - Clicca "Create Instance"
   - Configurazione suggerita:
     - **Image**: Ubuntu 22.04 LTS
     - **Shape**: Ampere (ARM) - sempre gratuito
     - **Storage**: 50GB
4. Salva la chiave privata SSH

### Step 2: Configura Networking

1. Nel Cloud Console:
   - Clicca sull'istanza > Primary VNIC
   - Subnet details > Security List
   - Add Ingress Rule:
     - **CIDR**: 0.0.0.0/0
     - **Destination Port Range**: 80,443
     - **Protocol**: TCP

2. Configura firewall dell'istanza:
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Step 3: Installa Dipendenze

Connettiti via SSH e installa:

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Installa Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Installa Git
sudo apt install -y git
```

### Step 4: Deploy dell'Applicazione

```bash
# Clone del repository
git clone https://github.com/tuousername/giuseppe-dashboard.git
cd giuseppe-dashboard

# Copia i file di configurazione
cp docker/.env.example docker/.env

# Modifica le variabili di ambiente
nano docker/.env
# Cambia:
# - SECRET_KEY con una stringa casuale forte
# - WEATHER_API_KEY con la tua chiave
# - NEXT_PUBLIC_API_URL con il tuo dominio
# - DATABASE_PASSWORD con una password sicura
# - POSTGRES_PASSWORD con una password sicura
```

### Step 5: Avvia i Servizi

```bash
cd docker
docker-compose up -d

# Verifica che sia in esecuzione
docker-compose ps

# Crea l'utente admin
docker-compose exec backend python -m app.cli create-admin \
  --username admin \
  --email tua@email.com \
  --password password-forte
```

### Step 6: Configura SSL

Vedi la sezione [SSL/TLS con Let's Encrypt](#ssltls-con-lets-encrypt)

### Vantaggi Oracle Cloud Free
- Completamente gratuito per sempre
- 2 istanze VM sempre gratuite
- Database PostgreSQL gratuito
- IP pubblico statico
- Buona uptime

### Svantaggi Oracle Cloud Free
- ARM architecture (non tutti i servizi supportati)
- Limiti di banda
- Interfaccia più complessa

---

## Opzione 2: Hetzner VPS

Hetzner offre VPS affidabili a prezzi bassi (~€3/mese).

### Step 1: Crea Server

1. Vai su hetzner.cloud
2. Sign up e accedi
3. Create Server:
   - **Image**: Ubuntu 22.04
   - **Type**: CPX11 (2 vCPU, 2GB RAM) - ~€3.50/mese
   - **Location**: Scegli quella più vicina
   - **Storage**: 25GB SSD è sufficiente
4. Salva la password root temporanea

### Step 2: Connessione SSH

```bash
# SSH con password ricevuta per email
ssh root@your-server-ip

# Primo login: cambia password
passwd

# Crea utente non-root (consigliato)
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### Step 3: Installa Docker

```bash
# Come utente deploy
curl -fsSL https://get.docker.com -o get-docker.sh
sudo bash get-docker.sh
sudo usermod -aG docker deploy

# Log out e in di nuovo per applicare i cambiamenti
exit
ssh deploy@your-server-ip

# Verifica
docker --version
docker-compose --version
```

### Step 4: Setup Firewall

```bash
# Abilita UFW
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw status
```

### Step 5: Deploy Applicazione

```bash
git clone https://github.com/tuousername/giuseppe-dashboard.git
cd giuseppe-dashboard

# Copia e modifica il file .env
cp docker/.env.example docker/.env
nano docker/.env
```

### Step 6: Avvia i Servizi

```bash
cd docker
docker-compose up -d

# Verifica lo status
docker-compose ps

# Crea utente admin
docker-compose exec backend python -m app.cli create-admin \
  --username admin \
  --email tua@email.com \
  --password password-forte
```

### Vantaggi Hetzner
- Prezzo molto basso
- Performance buone
- Supporto affidabile
- Datacenter in EU
- GDPR compliant

### Svantaggi Hetzner
- Non offre tier gratuito
- Per grandi volumi: addebiti aggiuntivi

---

## Opzione 3: Home Server + Cloudflare Tunnel

Ospita il dashboard a casa usando internet già esistente.

### Prerequisiti
- Router con accesso alle impostazioni (consigliato)
- Connessione internet stabile
- Dominio (gratuito da Freenom.com o a pagamento)
- Account Cloudflare gratuito

### Step 1: Configurazione Hardware

1. **Server fisico**:
   - Vecchio laptop/PC con Ubuntu 22.04 LTS
   - Raspberry Pi 4+ (8GB RAM minimo)
   - Qualsiasi computer lasciato acceso

2. **Requisiti minimi**:
   - CPU: dual-core
   - RAM: 2GB (4GB preferito)
   - Storage: 20GB
   - Connessione: 50 Mbps upload

### Step 2: Installa Docker

```bash
# Su Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo bash get-docker.sh
sudo usermod -aG docker $USER
```

### Step 3: Configura Cloudflare

Cloudflare Tunnel crea una connessione sicura senza esporre il tuo IP:

1. Vai su dash.cloudflare.com
2. Registra il tuo dominio o usa uno gratuito
3. Installa Cloudflare Tunnel:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

4. Autentica:
```bash
cloudflared tunnel login
```

5. Crea il tunnel:
```bash
cloudflared tunnel create dashboard
```

6. Configura routing in `~/.cloudflared/config.yml`:
```yaml
tunnel: dashboard
credentials-file: /home/deploy/.cloudflare-tunnel-creds.json

ingress:
  - hostname: dashboard.tuodominio.com
    service: http://localhost:3000
  - hostname: api.dashboard.tuodominio.com
    service: http://localhost:8000
  - service: http_status:404
```

7. Configura il DNS in Cloudflare:
   - Vai a DNS settings
   - Per `dashboard.tuodominio.com`:
     - Type: CNAME
     - Name: dashboard
     - Content: `dashboard.cfargotunnel.com`
   - Ripeti per `api.dashboard.tuodominio.com`

8. Avvia il tunnel:
```bash
cloudflared tunnel run dashboard
```

9. (Opzionale) Avvia come servizio systemd:
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### Step 4: Deploy Applicazione

```bash
git clone https://github.com/tuousername/giuseppe-dashboard.git
cd giuseppe-dashboard

cp docker/.env.example docker/.env
nano docker/.env
# Modifica: NEXT_PUBLIC_API_URL=https://api.dashboard.tuodominio.com
```

### Step 5: Avvia i Servizi

```bash
cd docker
docker-compose up -d
```

### Vantaggi Home Server
- Completamente gratuito (già hai internet)
- Pieno controllo dei dati
- Nessun provider terzo
- Ideale per privacy

### Svantaggi Home Server
- Affidabilità dipende da internet home
- Consumo energetico 24/7
- Velocità upload limitata
- Manutenzione locale

---

## SSL/TLS con Let's Encrypt

HTTPS è essenziale per la sicurezza. Let's Encrypt offre certificati gratuiti.

### Metodo 1: Certbot (Automatico)

```bash
# Installa Certbot
sudo apt install -y certbot python3-certbot-nginx

# Crea certificato
sudo certbot certonly --standalone \
  -d dashboard.tuodominio.com \
  -d api.dashboard.tuodominio.com \
  --email tuaemail@example.com \
  --agree-tos

# I certificati verranno salvati in:
# /etc/letsencrypt/live/dashboard.tuodominio.com/
```

### Metodo 2: Docker (Con Nginx)

1. Crea docker-compose con Nginx:
```yaml
version: '3.9'

services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    networks:
      - dashboard-network

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot; sleep 12h & wait $${!}; done;'"
```

2. Avvia:
```bash
docker-compose up -d
```

3. Ottieni certificato:
```bash
docker-compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d dashboard.tuodominio.com \
  --email tuaemail@example.com \
  --agree-tos
```

### Rinnovi Automatici

Let's Encrypt richiede rinnovamento ogni 90 giorni. Certbot lo fa automaticamente:

```bash
# Cron job (esegui una volta)
sudo crontab -e

# Aggiungi:
0 12 * * * certbot renew --quiet --no-eff-email

# Verifica
sudo crontab -l
```

### Configurazione Nginx

Nel tuo `nginx.conf`, abilita SSL:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dashboard.tuodominio.com;

    ssl_certificate /etc/letsencrypt/live/dashboard.tuodominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.tuodominio.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest della configurazione
}

# Redirect HTTP -> HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

---

## Configurazione Domain

### Registra un Dominio

**Opzioni gratuite**:
- Freenom.com (.tk, .ml, .ga, .cf) - completamente gratuito
- LocalHost.io - domini subito disponibili

**Opzioni a pagamento** (consigliate):
- Namecheap
- GoDaddy
- Google Domains
- Ionos

### Configura DNS

Dopo aver registrato il dominio:

1. **Se ospiti su VPS/Cloud**:
   ```
   A record: dashboard.tuodominio.com -> IP_DEL_SERVER
   A record: api.dashboard.tuodominio.com -> IP_DEL_SERVER
   ```

2. **Se ospiti su Cloudflare Tunnel**:
   ```
   CNAME record: dashboard -> dashboard.cfargotunnel.com
   CNAME record: api -> dashboard.cfargotunnel.com
   ```

3. **Se ospiti su home server con IP dinamico**:
   - Usa Cloudflare (consigliato)
   - Oppure Dynamic DNS con il tuo provider

### Verificare la Configurazione

```bash
# Test DNS propagazione
nslookup dashboard.tuodominio.com
dig dashboard.tuodominio.com

# Test HTTPS
curl https://dashboard.tuodominio.com -I

# Verifica certificato
openssl s_client -connect dashboard.tuodominio.com:443
```

---

## Hardening di Sicurezza

### Firewall UFW (Linux)

```bash
# Abilita UFW
sudo ufw enable

# Permetti SSH (IMPORTANTE: fai questo PRIMA di abilitare!)
sudo ufw allow 22/tcp

# Permetti HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Nega tutto il resto
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Visualizza regole
sudo ufw status verbose

# Esempio completo:
sudo ufw allow from any to any port 22 proto tcp
sudo ufw allow from any to any port 80 proto tcp
sudo ufw allow from any to any port 443 proto tcp
sudo ufw enable
```

### Fail2Ban (Protezione da Brute Force)

```bash
# Installa
sudo apt install -y fail2ban

# Configura per SSH
sudo tee /etc/fail2ban/jail.local > /dev/null << EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
findtime = 10m
bantime = 1h
EOF

# Avvia il servizio
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# Verifica IP bannati
sudo fail2ban-client status sshd
```

### SSH Hardening

```bash
# Backup della configurazione originale
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Modifica SSH config
sudo nano /etc/ssh/sshd_config

# Cambia/aggiungi queste linee:
Port 22                             # Cambia se vuoi (es: 2222)
PermitRootLogin no                  # Disabilita login root
PasswordAuthentication no           # Solo chiavi SSH
PubkeyAuthentication yes
X11Forwarding no
PermitEmptyPasswords no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountInterval 2

# Riavvia SSH
sudo systemctl restart ssh

# Test la connessione (DA UN ALTRO TERMINALE!)
ssh -i chiave.pem deploy@server-ip
```

### Gestione Chiavi SSH

```bash
# Genera nuova chiave (se non hai già)
ssh-keygen -t ed25519 -C "email@example.com"

# Copia chiave pubblica sul server
ssh-copy-id -i ~/.ssh/id_ed25519 deploy@server-ip

# Verifica accesso
ssh deploy@server-ip

# Disabilita password auth nel server
echo "PasswordAuthentication no" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### Aggiornamenti Automatici

```bash
# Installa unattended-upgrades
sudo apt install -y unattended-upgrades

# Configura
sudo dpkg-reconfigure -plow unattended-upgrades

# Verifica che è abilitato
sudo systemctl status unattended-upgrades

# Log degli aggiornamenti
tail -f /var/log/unattended-upgrades/unattended-upgrades.log
```

### Docker Security

```bash
# Limita le risorse del container
# Nel docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

# Esegui con utente non-root (già fatto nel Dockerfile)
# Disabilita i comandi privilegiati:
services:
  backend:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

# Usa read-only filesystem dove possibile:
    volumes:
      - /app/data:/data:rw
    read_only: true
```

### Hardening PostgreSQL

```bash
# Accedi al database
docker-compose exec postgres psql -U dashboard -d dashboard

# Cambia password admin
ALTER USER dashboard WITH PASSWORD 'new-strong-password';

# Crea user separato solo lettura (per backup)
CREATE USER backup_user WITH PASSWORD 'backup-password';
GRANT CONNECT ON DATABASE dashboard TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;

# Revoca comandi pericolosi
REVOKE DROP ON DATABASE dashboard FROM dashboard;

# Abilita logging
# Nel file postgresql.conf:
log_connections = on
log_disconnections = on
log_statement = 'all'
log_duration = on
```

---

## Backup e Recovery

### Backup Automatico del Database

```bash
# Crea script di backup
mkdir -p ~/backups
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
BACKUP_FILE="$BACKUP_DIR/dashboard_$DATE.sql.gz"

docker-compose -f ~/giuseppe-dashboard/docker/docker-compose.yml exec -T postgres pg_dump -U dashboard dashboard | gzip > "$BACKUP_FILE"

# Mantieni solo gli ultimi 7 giorni di backup
find "$BACKUP_DIR" -name "dashboard_*.sql.gz" -mtime +7 -delete

echo "Backup completato: $BACKUP_FILE"
EOF

chmod +x ~/backup-db.sh

# Aggiungi a cron (ogni giorno a mezzanotte)
crontab -e

# Aggiungi:
0 0 * * * /home/deploy/backup-db.sh
```

### Backup dei Dati dell'Applicazione

```bash
# Backup di tutti i dati
docker-compose exec -T postgres pg_dump -U dashboard dashboard > backup_$(date +%Y%m%d).sql

# Backup con tar
tar -czf appdata_backup_$(date +%Y%m%d).tar.gz \
  docker/docker-compose.yml \
  docker/.env \
  ../backend/ \
  ../frontend/

# Copia su server esterno (consigliato)
scp appdata_backup_*.tar.gz user@backup-server:/backup/
```

### Recovery da Backup

```bash
# Ripristina database da backup
gunzip < backup_20240328.sql.gz | \
  docker-compose exec -T postgres psql -U dashboard -d dashboard

# Verifica il ripristino
docker-compose exec postgres psql -U dashboard -d dashboard -c "SELECT COUNT(*) FROM users;"
```

### Backup su Cloud Storage (AWS S3)

```bash
# Installa AWS CLI
sudo apt install -y awscli

# Configura credenziali
aws configure

# Backup automatico su S3
cat > ~/backup-s3.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose -f ~/giuseppe-dashboard/docker/docker-compose.yml exec -T postgres pg_dump -U dashboard dashboard | \
  gzip | \
  aws s3 cp - s3://mio-bucket/backups/dashboard_$DATE.sql.gz

echo "Backup caricato su S3"
EOF

chmod +x ~/backup-s3.sh

# Aggiungi a cron
crontab -e
# 0 2 * * * /home/deploy/backup-s3.sh
```

---

## Monitoring e Logging

### Log dei Servizi

```bash
# Visualizza log in tempo reale
docker-compose logs -f

# Log di un servizio specifico
docker-compose logs -f backend

# Ultimi 100 linee
docker-compose logs --tail=100 backend

# Salva su file
docker-compose logs > logs_$(date +%Y%m%d).txt
```

### Health Check

```bash
# Verifica che i servizi siano up
docker-compose ps

# Check manuale
curl http://localhost:8000/health
curl http://localhost:3000

# Monitora risorse
docker stats
```

### Log Aggregation con ELK Stack (Avanzato)

Per monitoraggio professionale, considera:

1. **Elasticsearch**: Data storage
2. **Logstash**: Log processing
3. **Kibana**: Visualization

```yaml
# Aggiunta a docker-compose.yml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
  environment:
    discovery.type: single-node

logstash:
  image: docker.elastic.co/logstash/logstash:8.0.0
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

kibana:
  image: docker.elastic.co/kibana/kibana:8.0.0
  ports:
    - "5601:5601"
```

### Prometheus + Grafana (Monitoraggio Metriche)

```bash
# Aggiungi a docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    GF_SECURITY_ADMIN_PASSWORD: admin
```

### Alert via Email

Configura notifiche per downtime:

```bash
# Crea script di monitoring
cat > ~/monitor.sh << 'EOF'
#!/bin/bash
if ! curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "Dashboard is DOWN!" | \
    mail -s "Alert: Dashboard Down" email@example.com
fi
EOF

chmod +x ~/monitor.sh

# Aggiungi a cron (ogni 5 minuti)
*/5 * * * * /home/deploy/monitor.sh
```

---

## Troubleshooting

### Problema: "Porta 80/443 già in uso"

```bash
# Trova il processo che usa la porta
sudo lsof -i :80
sudo lsof -i :443

# Uccidi il processo (se non serviva)
sudo kill -9 PID

# O cambia porta in docker-compose
ports:
  - "8080:80"  # HTTP esterno su 8080
  - "8443:443"  # HTTPS esterno su 8443
```

### Problema: "Container non start"

```bash
# Visualizza gli errori
docker-compose logs backend

# Ricrea il container
docker-compose up -d --force-recreate backend

# Ricostruisci l'immagine
docker-compose build --no-cache backend
docker-compose up -d
```

### Problema: "Memoria piena"

```bash
# Visualizza utilizzo disco
df -h

# Visualizza cosa occupa spazio
du -sh /*

# Pulisci Docker
docker system prune -a --volumes

# Compatta lo spazio su disco
docker exec postgres vacuum full;
```

### Problema: "Database corrotto"

```bash
# Controlla l'integrità
docker-compose exec postgres pg_dump -U dashboard database > /dev/null

# Ripristina da backup
gunzip < backup.sql.gz | docker-compose exec -T postgres psql -U dashboard -d database

# Riavvia il servizio
docker-compose restart postgres
```

### Problema: "Apple Health non sincronizza"

```bash
# Controlla i log
docker-compose logs celery-worker | grep -i health

# Verifica la connettività
curl -X POST http://localhost:8000/api/v1/health/import \
  -H "Content-Type: application/json" \
  -d '{"auth_token": "test", "data": []}'

# Controlla il token API
docker-compose exec backend python -c "
from app.models import User
user = User.query.filter_by(username='admin').first()
print(user.api_token)
"
```

### Problema: "Certificato SSL scaduto"

```bash
# Controlla scadenza
echo | openssl s_client -servername dashboard.tuodominio.com -connect dashboard.tuodominio.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Rinnova manualmente
sudo certbot renew --force-renewal

# Ricarica Nginx
sudo systemctl reload nginx
# o
docker-compose restart nginx
```

### Problema: "Lento/timeout delle richieste"

```bash
# Controlla risorse disponibili
docker stats

# Aumenta risorse nel docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G

# Ottimizza il database
docker-compose exec postgres analyze;
docker-compose exec postgres reindex database dashboard;
```

---

## Checklist Pre-Produzione

Prima di andare live:

- [ ] Secret key cambiata e casuale
- [ ] Credenziali database cambiate
- [ ] HTTPS/SSL configurato
- [ ] Firewall correttamente configurato
- [ ] SSH hardening completato
- [ ] Fail2ban abilitato
- [ ] Backup automatici configurati
- [ ] Monitoring setup
- [ ] DNS propagato correttamente
- [ ] Test di recovery da backup
- [ ] Email di contatto aggiornata nei dati
- [ ] Privacy policy e Terms of Service (se pubblico)
- [ ] Rate limiting abilitato
- [ ] CORS correttamente configurato
- [ ] Log aggregation setup
- [ ] Uptime monitoring configurato

---

## Supporto e Risorse

- Documentazione Docker: https://docs.docker.com
- Certbot: https://certbot.eff.org
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel
- Security best practices: https://cheatsheetseries.owasp.org
- Oracle Cloud docs: https://docs.oracle.com/en-us/iaas/
- Hetzner docs: https://docs.hetzner.cloud

---

**Ultima modifica**: 2024-03-28

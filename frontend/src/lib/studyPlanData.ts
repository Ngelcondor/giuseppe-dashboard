// CRTP Study Plan — Roadmap completa parsata dal file markdown
// Date: 28 Aprile 2026 → 23 Settembre 2026

export interface StudyTaskSeed {
  text: string;
}

export interface StudyDaySeed {
  date: string; // ISO YYYY-MM-DD
  label: string;
  tasks: string[];
  isRest?: boolean;
  hours?: string;
}

export interface StudyWeekSeed {
  id: string;
  label: string;
  range: string;
  days: StudyDaySeed[];
}

export interface StudyPhaseSeed {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bg: string;
  weeks: StudyWeekSeed[];
}

export const CRTP_PLAN: StudyPhaseSeed[] = [
  {
    id: 'fase-0',
    shortLabel: 'Fase 0',
    label: 'Setup Ambiente',
    description: 'Lab pivottato su Hetzner dedicato (Proxmox + GOAD). Settimana di preparazione hardware e workspace',
    color: 'text-slate-300',
    bg: 'bg-slate-500/10 border-slate-500/20',
    weeks: [
      {
        id: 'w0',
        label: 'Settimana 0',
        range: '28 Aprile - 4 Maggio',
        days: [
          {
            date: '2026-04-28',
            label: 'Mar 28 Apr — Mac + Parallels base ✅ COMPLETATO',
            hours: '~6h',
            tasks: [
              'Verifica Kali Parallels VM funzionante (10.211.55.4 attiva)',
              'Aggiorna Kali: sudo apt update && sudo apt full-upgrade -y',
              'Crea snapshot Kali base: "Kali-Pre-CRTP-Clean"',
              'Crea VM Windows 11 (già presente, mai usata)',
              'Snapshot Windows: "Win11-Clean"',
              'BONUS: Win11 isolata da Mac (shared folders/volumes/profile OFF, solo clipboard ON)',
              'BONUS: Win11 health check completo (RAM, IP, ping Kali, isolamento, no mount Mac)',
              'BONUS: Struttura ~/crtp-notes/ creata sulla Kali',
            ],
          },
          {
            date: '2026-04-29',
            label: 'Mer 29 Apr — Decisione architettura + Hetzner ordinato ✅ COMPLETATO',
            hours: '~10h',
            tasks: [
              'Tentativo Azure cloud con account Azure for Students UOC ($100/12 mesi)',
              'Scoperta blocco quota: cap 6 vCPU non aumentabile per Students',
              'Pivot decisionale: locale ❌ / Azure ❌ / AWS ❌ / GCP ❌ / Hetzner ✅',
              'Ordine AX41-NVMe Helsinki HEL1, Debian 12 base, SSH key dedicata hetzner_crtp',
              'Server attivato in 8 minuti (62GB RAM, 4 core, RAID 1 software 436G)',
              'IP pubblico: 65.109.49.214 / IPv6 2a01:4f9:5a:2740::2',
              'Test SSH login OK',
              'Repo GOAD clonato in ~/CRTP-Tools/GOAD (sulla Kali)',
              'Lessons learned scritte in ~/crtp-notes/DIARIO.md',
            ],
          },
          {
            date: '2026-04-30',
            label: 'Gio 30 Apr — Hardening Debian + planning weekend',
            hours: '1-2h',
            tasks: [
              'Verifica SSH ancora attivo: ssh hetzner',
              'Aggiornamento sistema completo: apt update && apt full-upgrade -y',
              'Setup utente non-root con sudo (es. giuseppe)',
              'Disabilitare login SSH come root + solo SSH key (no password)',
              'Install fail2ban + ufw firewall base',
              'Reboot test, verifica accesso utente non-root via SSH',
              'Snapshot mentale dell\'IP server, hostname, credenziali (in 1Password)',
              'Pianificare blocco Ven 1 Mag (5-7h continuative) per Proxmox install',
            ],
          },
          {
            date: '2026-05-01',
            label: 'Ven 1 Mag — Proxmox install (PARTE 1, blocco mattina)',
            hours: '4-5h',
            tasks: [
              'Rilettura https://pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_12_Bookworm',
              'Add Proxmox repo a Debian (key + sources.list.d)',
              'apt install proxmox-ve postfix open-iscsi',
              'Reboot kernel Proxmox',
              'Verifica accesso web UI Proxmox: https://65.109.49.214:8006',
              'Setup WireGuard VPN per accesso sicuro al pannello (NO esposizione 8006 su Internet)',
              'Install WireGuard client sul Mac, test connessione',
              'Snapshot: "Proxmox-VE-base-clean"',
            ],
          },
          {
            date: '2026-05-02',
            label: 'Sab 2 Mag — Networking + GOAD provisioning (PARTE 2, blocco lungo)',
            hours: '6-8h',
            tasks: [
              'Crea bridge vmbr1 su Proxmox (rete privata interna 10.10.10.0/24)',
              'Setup pfSense o opnsense come VM router (NAT + DHCP + DNS interno)',
              'Test VM Linux su vmbr1: deve pingare Internet ma NON essere raggiungibile da fuori',
              'Decisione provider GOAD: Vagrant + libvirt vs Packer + manual import',
              'Trasferisci repo GOAD dalla Kali al server Hetzner: rsync -av ~/CRTP-Tools/GOAD/ hetzner:/opt/GOAD/',
              'Configura globalsettings.ini per provider scelto',
              'Lancia ./goad.sh -t install -l GOAD -p <provider>',
              'Provisioning unattended (4-6h) — monitora ogni 60min',
              'Snapshot Proxmox di tutte VM una volta GOAD attivo: "GOAD-fresh-2026-05-02"',
            ],
          },
          {
            date: '2026-05-03',
            label: 'Dom 3 Mag — Buffer / Tool Arsenal CRTP',
            hours: '0-4h',
            tasks: [
              'Se Sab chiude pulito → giorno di RIPOSO',
              'Se overflow → completa GOAD provisioning + test connessione lab dal Mac via VPN+RDP',
              'Se tutto pulito → anticipa Tool Arsenal:',
              'Scarica PowerView.ps1 in ~/CRTP-Tools/',
              'Scarica PowerUp.ps1',
              'Scarica Mimikatz',
              'Scarica/compila Rubeus',
              'Scarica SharpHound + BloodHound',
              'Scarica Invoke-Mimikatz.ps1',
              'Scarica Kekeo',
              'Scarica PsExec64.exe (Sysinternals)',
              'Scarica AD Module bypass',
              'Crea cheatsheet personale 99-cheatsheets/tools-arsenal.md',
            ],
          },
          {
            date: '2026-05-04',
            label: 'Lun 4 Mag — Workspace + Calendario + RIPOSO ATTIVO',
            tasks: [
              'Imposta Notion/Obsidian con la struttura sopra (sync da ~/crtp-notes/)',
              'Crea calendario CRTP nel tuo iCloud/Google Calendar',
              'Color code: 🔵 teoria, 🟢 lab, 🔴 esame',
              'Blocca slot studio quotidiano',
              'Imposta Apple Watch reminder per pomodoro (ogni 45 min)',
              'Iscriviti a r/redteamsec, r/AskNetsec',
              'Iscriviti Discord Altered Security',
              'Iscriviti Discord TheCyberMentor',
              'TryHackMe: verifica subscription attiva, bookmark AD Basics / Attacking Kerberos / Attacktive Directory',
              'HackTheBox Academy: account free, bookmark moduli AD',
              'Pomeriggio/sera: RIPOSO ATTIVO. NO cybersec. Camminate, vita sociale, cucina.',
              'Prepara mentalmente: il 5 maggio si parte sul serio',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'fase-1',
    shortLabel: 'Fase 1',
    label: 'Pre-Study Gratuito',
    description: 'AD Fundamentals, PowerShell, BloodHound, Lateral Movement (Maggio 2026)',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    weeks: [
      {
        id: 'w1',
        label: 'Settimana 1',
        range: '5-11 Maggio — Active Directory Fundamentals',
        days: [
          {
            date: '2026-05-05',
            label: 'Mar 5 Mag — AD Basics teoria',
            hours: '4h+',
            tasks: [
              'Mattino (2h): TryHackMe AD Basics Task 1-3 (Domain, Forest, Trust, OU, GPO)',
              'Note in 01-enumeration/01-ad-fundamentals.md',
              'Pomeriggio (2h): TryHackMe AD Basics Task 4-6 (DNS, DHCP, Replication)',
              'Sera: video YouTube "Active Directory Tutorial for Beginners"',
            ],
          },
          {
            date: '2026-05-06',
            label: 'Mer 6 Mag — AD pratica enumeration',
            hours: '5h+',
            tasks: [
              'Mattino (3h): TryHackMe AD Basics completo + lab',
              'Pomeriggio (2h): Setup PowerShell sul tuo Win11 VM',
              'Set-ExecutionPolicy Bypass -Scope CurrentUser',
              'Test esecuzione PowerView',
              'Sera: leggi articolo "Active Directory Pentesting" su HackTricks',
            ],
          },
          {
            date: '2026-05-07',
            label: 'Gio 7 Mag — Kerberos teoria approfondita',
            hours: '5h',
            tasks: [
              'Mattino (3h): TryHackMe Attacking Kerberos Task 1-4',
              'Studio TGT, TGS, AS-REQ, AS-REP flow',
              'Disegna diagrammi Kerberos a mano',
              'Pomeriggio (2h): leggi paper Kerberos MIT',
            ],
          },
          {
            date: '2026-05-08',
            label: 'Ven 8 Mag — Kerberos pratica',
            hours: '5h',
            tasks: [
              'Mattino (3h): TryHackMe Attacking Kerberos Task 5-end',
              'Kerberoasting hands-on',
              'AS-REP roasting',
              'Pomeriggio (2h): pratica con Rubeus su Win11 VM',
            ],
          },
          {
            date: '2026-05-09',
            label: 'Sab 9 Mag — GOAD Initial Foothold',
            hours: '5h',
            tasks: [
              'Avvia GOAD, fai initial enumeration',
              'nmap recon contro DC',
              'responder setup base',
              'crackmapexec su SMB',
              'Documenta ogni comando in 09-screenshots/goad-day1.md',
            ],
          },
          {
            date: '2026-05-10',
            label: 'Dom 10 Mag — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-05-11',
            label: 'Lun 11 Mag — Review settimanale',
            hours: '4h',
            tasks: [
              '2h: ripassa note settimana 1',
              '2h: PowerView basics su Win11 VM',
              'Get-NetUser, Get-NetGroup, Get-NetComputer',
              'Aggiorna cheatsheet powerview-cheatsheet.md',
              'Self-assessment: so spiegare Kerberos flow completo',
              'Self-assessment: so fare Kerberoasting da Linux',
              'Self-assessment: ho enumerato users/groups/computers via PowerView',
            ],
          },
        ],
      },
      {
        id: 'w2',
        label: 'Settimana 2',
        range: '12-18 Maggio — PowerShell Mastery',
        days: [
          {
            date: '2026-05-12',
            label: 'Mar 12 Mag — PowerShell fundamentals',
            hours: '5h',
            tasks: [
              'Mattino (3h): corso PowerShell for Pentesters (HTB Academy o YouTube)',
              'Variabili, cmdlet, pipeline',
              'Loops e conditional',
              'Pomeriggio (2h): scripting su Win11 VM',
              'Script base che enumera users, salva in CSV',
            ],
          },
          {
            date: '2026-05-13',
            label: 'Mer 13 Mag — PowerView deep dive',
            hours: '5h',
            tasks: [
              'Mattino (3h): guida PowerView completa (HarmJ0y gist)',
              'Pomeriggio (2h): pratica su GOAD',
              'Get-DomainUser',
              'Get-DomainGroup -GroupName "Domain Admins"',
              'Get-DomainTrust',
            ],
          },
          {
            date: '2026-05-14',
            label: 'Gio 14 Mag — AMSI bypass + Defender',
            hours: '5h',
            tasks: [
              'Mattino (2h): leggi "AMSI bypass" articles (3 diversi su Medium)',
              'Pomeriggio (3h): pratica bypass AMSI su Win11 con Defender attivo',
              'Reflection-based bypass',
              'String obfuscation',
              'Loading PowerView in modo offuscato',
            ],
          },
          {
            date: '2026-05-15',
            label: 'Ven 15 Mag — Constrained Language Mode',
            hours: '5h',
            tasks: [
              'Mattino (2h): studia CLM e bypass',
              'Pomeriggio (3h): pratica setup CLM e bypass su VM',
            ],
          },
          {
            date: '2026-05-16',
            label: 'Sab 16 Mag — GOAD enumeration completa',
            hours: '5h',
            tasks: [
              'Enumeration completa GOAD con PowerView',
              'Users con SPN',
              'Users con AS-REP roastable',
              'ACL interessanti',
              'Trust mapping',
              'Crea report Markdown enum-goad-completa.md',
            ],
          },
          {
            date: '2026-05-17',
            label: 'Dom 17 Mag — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-05-18',
            label: 'Lun 18 Mag — Review settimana 2',
            hours: '5h',
            tasks: [
              '3h: pratica AMSI bypass diverse tecniche',
              '2h: aggiorna cheatsheets',
              'Self-assessment: bypass AMSI su Win11 con Defender ON',
              'Self-assessment: PowerView in modalità stealth',
              'Self-assessment: CLM bypass',
            ],
          },
        ],
      },
      {
        id: 'w3',
        label: 'Settimana 3',
        range: '19-25 Maggio — BloodHound + Lateral Movement',
        days: [
          {
            date: '2026-05-19',
            label: 'Mar 19 Mag — BloodHound teoria',
            hours: '5h',
            tasks: [
              'Mattino (2h): introduzione BloodHound + Cypher queries',
              'Pomeriggio (3h): setup BloodHound CE su Mac',
              'Raccolta dati GOAD via SharpHound',
            ],
          },
          {
            date: '2026-05-20',
            label: 'Mer 20 Mag — BloodHound pratica',
            hours: '5h',
            tasks: [
              'Analisi GOAD via BloodHound',
              'Trova "Shortest Path to Domain Admins"',
              'Identifica Kerberoastable users',
              'Identifica DCSync rights',
            ],
          },
          {
            date: '2026-05-21',
            label: 'Gio 21 Mag — Lateral Movement teoria',
            hours: '5h',
            tasks: [
              'Mattino (3h): tecniche LM',
              'WMI, WinRM, PsExec, DCOM',
              'Pass-the-Hash, Pass-the-Ticket, OverPass-the-Hash',
              'Pomeriggio (2h): video IppSec lateral movement (2 box AD)',
            ],
          },
          {
            date: '2026-05-22',
            label: 'Ven 22 Mag — Lateral Movement pratica',
            hours: '5h',
            tasks: [
              'Pratica su GOAD',
              'PtH con Mimikatz',
              'PtT con Rubeus',
              'Lateral via WinRM',
            ],
          },
          {
            date: '2026-05-23',
            label: 'Sab 23 Mag — TryHackMe Attacktive Directory',
            hours: '5h',
            tasks: [
              'Completa room "Attacktive Directory" end-to-end',
              'Documenta ogni step',
            ],
          },
          {
            date: '2026-05-24',
            label: 'Dom 24 Mag — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-05-25',
            label: 'Lun 25 Mag — Review settimana 3',
            hours: '5h',
            tasks: [
              '3h: rivedi BloodHound queries custom',
              '2h: pratica lateral movement con tecniche diverse',
              'Self-assessment: dati BloodHound stealthy',
              'Self-assessment: PtH, PtT, OverPtH',
              'Self-assessment: leggere e creare query Cypher',
            ],
          },
        ],
      },
      {
        id: 'w4',
        label: 'Settimana 4',
        range: '26 Maggio - 1 Giugno — Pre-CRTP Final Prep',
        days: [
          {
            date: '2026-05-26',
            label: 'Mar 26 Mag — Privilege Escalation Windows',
            hours: '5h',
            tasks: [
              'Mattino (3h): PowerUp.ps1 modulo studio',
              'Pomeriggio (2h): pratica privesc su Win11 VM',
            ],
          },
          {
            date: '2026-05-27',
            label: 'Mer 27 Mag — Mimikatz mastery',
            hours: '5h',
            tasks: [
              'Mattino (2h): storia + capacità Mimikatz',
              'Pomeriggio (3h): pratica',
              'sekurlsa::logonpasswords',
              'sekurlsa::tickets /export',
              'lsadump::dcsync /domain:goad.lab /user:krbtgt',
            ],
          },
          {
            date: '2026-05-28',
            label: 'Gio 28 Mag — Golden Ticket basics',
            hours: '5h',
            tasks: [
              'Forge Golden Ticket end-to-end su GOAD',
              'Estrazione krbtgt hash via DCSync',
              'Forge ticket con Mimikatz',
              'Pass-the-Ticket con Rubeus',
              'Verifica accesso DC',
            ],
          },
          {
            date: '2026-05-29',
            label: 'Ven 29 Mag — Buffer day',
            tasks: [
              'Recupera quello che ti è sfuggito nelle settimane 1-3',
              'Riposa se serve, NON sforzare',
            ],
          },
          {
            date: '2026-05-30',
            label: 'Sab 30 Mag — Black Friday alternative check',
            hours: '6h',
            tasks: [
              '1h: controlla se Altered Security ha sale estiva',
              '3h: leggi 3 review CRTP recenti su Medium',
              '2h: prepara mentalmente piano luglio-agosto',
            ],
          },
          {
            date: '2026-05-31',
            label: 'Dom 31 Mag — RIPOSO TOTALE',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-01',
            label: 'Lun 1 Giu — ACQUISTO CRTP 🎯',
            hours: '4h+',
            tasks: [
              'Mattino: vai su https://www.alteredsecurity.com/adlab',
              'Decisione: 30 giorni $249 o 60 giorni $349',
              'Acquista (lab access parte dopo qualche giorno)',
              'Pomeriggio (3h): scarica tutti i materiali',
              'Sera: organizza materiali in Notion/Obsidian',
              'Self-assessment: Kerberoasting end-to-end (3+ volte)',
              'Self-assessment: Golden Ticket forge',
              'Self-assessment: PowerView + SharpHound',
              'Self-assessment: AMSI bypass automatico',
              'Self-assessment: trust, GPO, ACL conceptually',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'fase-2',
    shortLabel: 'Fase 2',
    label: 'Studio Teoria CRTP + Lab',
    description: 'Tutti i 23 Learning Objectives ufficiali (Giugno 2026)',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    weeks: [
      {
        id: 'w5',
        label: 'Settimana 5',
        range: '2-8 Giugno — Course Theory Phase 1',
        days: [
          {
            date: '2026-06-02',
            label: 'Mar 2 Giu — LO1-2: Setup + Domain Enumeration',
            hours: '6h',
            tasks: [
              'Mattino (3h): video lecture + slides LO1-2',
              'Pomeriggio (3h): hands-on lab — domain enum esercizi',
              'Sera: note in 01-enumeration/',
            ],
          },
          {
            date: '2026-06-03',
            label: 'Mer 3 Giu — LO3: Trust Mapping',
            hours: '6h',
            tasks: [
              'Mattino (2h): video lecture LO3',
              'Pomeriggio (4h): hands-on lab — mappa trust nel lab CRTP',
              'Disegna diagramma forest a mano',
            ],
          },
          {
            date: '2026-06-04',
            label: 'Gio 4 Giu — LO4: Local Privilege Escalation',
            hours: '6h',
            tasks: [
              'Mattino (2h): video lecture',
              'Pomeriggio (4h): lab — completa tutti gli esercizi LO4',
            ],
          },
          {
            date: '2026-06-05',
            label: 'Ven 5 Giu — LO5: Lateral Movement',
            hours: '6h',
            tasks: [
              'Mattino (2h): video lecture',
              'Pomeriggio (4h): lab — pratica tutti i metodi LM',
            ],
          },
          {
            date: '2026-06-06',
            label: 'Sab 6 Giu — Buffer + Review',
            hours: '5h',
            tasks: [
              'Rivedi gli esercizi delle 4 sezioni',
              'Aggiorna cheatsheet',
            ],
          },
          {
            date: '2026-06-07',
            label: 'Dom 7 Giu — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-08',
            label: 'Lun 8 Giu — LO6: Domain Privilege Escalation',
            hours: '6h',
            tasks: [
              'Mattino (2h): video lecture',
              'Pomeriggio (4h): hands-on lab',
              'Focus su Kerberoasting + AS-REP roasting nel contesto lab',
            ],
          },
        ],
      },
      {
        id: 'w6',
        label: 'Settimana 6',
        range: '9-15 Giugno — Course Theory Phase 2',
        days: [
          {
            date: '2026-06-09',
            label: 'Mar 9 Giu — LO7: Domain Persistence',
            hours: '6h',
            tasks: [
              'Mattino (2h): teoria persistence techniques',
              'Pomeriggio (4h): lab — Golden, Silver, Diamond tickets',
            ],
          },
          {
            date: '2026-06-10',
            label: 'Mer 10 Giu — LO8-9: Cross Forest + Cross Domain',
            hours: '6h',
            tasks: [
              'Mattino (3h): video lecture',
              'Pomeriggio (3h): lab — exploit trust attacks',
            ],
          },
          {
            date: '2026-06-11',
            label: 'Gio 11 Giu — LO10: Forest Persistence',
            hours: '6h',
            tasks: [
              'Mattino (2h): video lecture',
              'Pomeriggio (4h): lab — completa esercizi',
            ],
          },
          {
            date: '2026-06-12',
            label: 'Ven 12 Giu — LO11: ADCS abuse basics',
            hours: '6h',
            tasks: [
              'Mattino (3h): ESC1, ESC8 attacks',
              'Pomeriggio (3h): lab esercizi',
            ],
          },
          {
            date: '2026-06-13',
            label: 'Sab 13 Giu — LO12: SQL Server attacks',
            hours: '5h',
            tasks: [
              'Lecture + lab',
              'Potrebbe NON essere nel tuo esame, ma copri comunque',
            ],
          },
          {
            date: '2026-06-14',
            label: 'Dom 14 Giu — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-15',
            label: 'Lun 15 Giu — Review intermedio',
            hours: '6h',
            tasks: [
              'Mattino (3h): rivedi tutto LO1-12',
              'Pomeriggio (3h): cheatsheet update + identifica gaps',
              'Self-assessment: hands-on di tutti i LO 1-12',
              'Self-assessment: Kerberoasting vs AS-REP roasting',
              'Self-assessment: Golden Ticket forge senza guida',
            ],
          },
        ],
      },
      {
        id: 'w7',
        label: 'Settimana 7',
        range: '16-22 Giugno — Course Theory Phase 3',
        days: [
          {
            date: '2026-06-16',
            label: 'Mar 16 Giu — LO13-15: Delegation attacks ⚠️',
            hours: '8h',
            tasks: [
              'Mattino (4h): teoria — Constrained, Unconstrained, RBCD',
              'Pomeriggio (4h): lab pratica end-to-end',
              '⚠️ Topic frequentissimo nell\'esame',
            ],
          },
          {
            date: '2026-06-17',
            label: 'Mer 17 Giu — Delegation Day 2 (deep dive)',
            hours: '5h',
            tasks: [
              'Pratica su lab + GOAD',
              'Crea cheatsheet delegation-attacks.md super dettagliata',
            ],
          },
          {
            date: '2026-06-18',
            label: 'Gio 18 Giu — LO16: ACL abuse',
            hours: '6h',
            tasks: [
              'Mattino (3h): teoria GenericAll, GenericWrite, WriteOwner, WriteDacl',
              'Pomeriggio (3h): lab — esercizi ACL',
            ],
          },
          {
            date: '2026-06-19',
            label: 'Ven 19 Giu — LO17: AdminSDHolder abuse',
            hours: '6h',
            tasks: [
              'Mattino (2h): teoria',
              'Pomeriggio (4h): lab + persistence chain',
            ],
          },
          {
            date: '2026-06-20',
            label: 'Sab 20 Giu — Buffer + recap',
            hours: '5h',
            tasks: ['Torna sui topic deboli identificati nei self-assessment'],
          },
          {
            date: '2026-06-21',
            label: 'Dom 21 Giu — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-22',
            label: 'Lun 22 Giu — LO18-20: Skeleton Key, DSRM, DCSync',
            hours: '7h',
            tasks: [
              'Mattino (3h): teoria',
              'Pomeriggio (4h): lab — esegui ogni attack manualmente',
            ],
          },
        ],
      },
      {
        id: 'w8',
        label: 'Settimana 8',
        range: '23-30 Giugno — Course Final + Lab Re-Run',
        days: [
          {
            date: '2026-06-23',
            label: 'Mar 23 Giu — LO21-22: AppLocker + AMSI bypass advanced',
            hours: '6h',
            tasks: [
              'Mattino (3h): bypass moderni',
              'Pomeriggio (3h): pratica laboratorio',
            ],
          },
          {
            date: '2026-06-24',
            label: 'Mer 24 Giu — LO23: Defender evasion',
            hours: '6h',
            tasks: [
              'Mattino (2h): tecniche stealth',
              'Pomeriggio (4h): lab pratica con Defender ON',
            ],
          },
          {
            date: '2026-06-25',
            label: 'Gio 25 Giu — Lab Run Completo #1',
            hours: '8h',
            tasks: [
              'Rifai tutto il lab dall\'inizio',
              'Foothold student → Enterprise Admin',
              'Senza guardare guida',
              'Cronometra il tempo',
            ],
          },
          {
            date: '2026-06-26',
            label: 'Ven 26 Giu — Lab Run Completo #2',
            hours: '6h',
            tasks: [
              'Rifai il lab provando tecniche alternative',
              'Dove possibile, prendi shortcut diversi',
            ],
          },
          {
            date: '2026-06-27',
            label: 'Sab 27 Giu — Self-mock exam',
            hours: '6h',
            tasks: [
              'Simula condizioni esame',
              'Lab "vergine" (chiedi reset al supporto)',
              'Niente guide',
              'Solo i tuoi cheatsheet',
            ],
          },
          {
            date: '2026-06-28',
            label: 'Dom 28 Giu — RIPOSO TOTALE',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-29',
            label: 'Lun 29 Giu — Cheatsheet consolidation',
            hours: '6h',
            tasks: [
              'Rivedi e consolida TUTTI i cheatsheet',
              'tools-arsenal.md',
              'kerberos-attacks.md',
              'delegation-attacks.md',
              'acl-abuse.md',
              'persistence-techniques.md',
              'bypass-defenses.md',
            ],
          },
          {
            date: '2026-06-30',
            label: 'Mar 30 Giu — Buffer',
            tasks: [
              'Identifica le tue 3 aree più deboli',
              'Studia mirato su quelle',
              'Self-assessment: completati tutti i 23 LO',
              'Self-assessment: rifatto il lab almeno 2 volte',
              'Self-assessment: cheatsheet in stato finale',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'fase-3',
    shortLabel: 'Fase 3',
    label: 'Lab Mastery + Pre-Esame',
    description: 'GOAD, HTB ProLab, Mock Exam, Active Recovery (Luglio - Inizio Agosto)',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    weeks: [
      {
        id: 'w9',
        label: 'Settimana 9',
        range: '1-7 Luglio — Mastery via GOAD',
        days: [
          {
            date: '2026-07-01',
            label: 'Mer 1 Lug — GOAD Run #1',
            hours: '6h',
            tasks: [
              'Pratica end-to-end su GOAD',
              'Mappa diversa rispetto a CRTP',
              'Forza nuovi metodi',
            ],
          },
          {
            date: '2026-07-02',
            label: 'Gio 2 Lug — GOAD Run #2 (alternative paths)',
            hours: '6h',
            tasks: ['Cerca path alternativi nello stesso lab'],
          },
          {
            date: '2026-07-03',
            label: 'Ven 3 Lug — Cheatsheet stress test',
            hours: '5h',
            tasks: [
              'Test ogni comando del cheatsheet su GOAD',
              'Rimuovi quelli che non funzionano in pratica',
            ],
          },
          {
            date: '2026-07-04',
            label: 'Sab 4 Lug — Buffer / leggera attività',
            hours: '3h',
            tasks: ['Rilegga write-ups CRTP altrui'],
          },
          {
            date: '2026-07-05',
            label: 'Dom 5 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-06',
            label: 'Lun 6 Lug — Topic deboli',
            hours: '6h',
            tasks: ['Identifica e correggi le 3 aree dove sei meno sicuro'],
          },
          {
            date: '2026-07-07',
            label: 'Mar 7 Lug — TryHackMe Throwback / Wreath',
            hours: '5h',
            tasks: [
              'Completa una network challenge complessa',
              'Variazione utile per non bruciarti su CRTP labs',
            ],
          },
        ],
      },
      {
        id: 'w10',
        label: 'Settimana 10',
        range: '8-14 Luglio — HackTheBox Pro Labs',
        days: [
          {
            date: '2026-07-08',
            label: 'Mer 8 Lug — Inizio HTB ProLab (Dante o RastaLabs)',
            hours: '6h',
            tasks: ['Enumeration + foothold'],
          },
          {
            date: '2026-07-09',
            label: 'Gio 9 Lug — ProLab Day 2',
            hours: '6h',
            tasks: ['Progressing'],
          },
          {
            date: '2026-07-10',
            label: 'Ven 10 Lug — ProLab Day 3',
            hours: '6h',
            tasks: ['Lateral movement'],
          },
          {
            date: '2026-07-11',
            label: 'Sab 11 Lug — ProLab Day 4',
            hours: '6h',
            tasks: ['Domain takeover'],
          },
          {
            date: '2026-07-12',
            label: 'Dom 12 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-13',
            label: 'Lun 13 Lug — ProLab completion',
            hours: '6h',
            tasks: ['Chiudi il lab + write-up personale'],
          },
          {
            date: '2026-07-14',
            label: 'Mar 14 Lug — Reset mentale',
            hours: '3h',
            tasks: [
              '3h: studio leggero',
              '3h: attività non-tech',
            ],
          },
        ],
      },
      {
        id: 'w11',
        label: 'Settimana 11',
        range: '15-21 Luglio — CRTP Lab Re-Subscribe',
        days: [
          {
            date: '2026-07-15',
            label: 'Mer 15 Lug — Acquisto extension lab',
            hours: '5h',
            tasks: [
              '$99 per 30 giorni extra',
              'Lab refresh, rivedi mappa',
            ],
          },
          {
            date: '2026-07-16',
            label: 'Gio 16 Lug — Lab full run',
            hours: '8h',
            tasks: [
              'Full enterprise compromise',
              'Cronometra',
              'Punta a < 10h totali',
            ],
          },
          {
            date: '2026-07-17',
            label: 'Ven 17 Lug — Lab alternative paths',
            hours: '6h',
            tasks: ['Trova 3 path diversi per arrivare allo stesso target'],
          },
          {
            date: '2026-07-18',
            label: 'Sab 18 Lug — Lab silent run',
            hours: '6h',
            tasks: ['Punta a OPSEC — nessun event nel SIEM'],
          },
          {
            date: '2026-07-19',
            label: 'Dom 19 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-20',
            label: 'Lun 20 Lug — Documentation prep',
            hours: '6h',
            tasks: [
              'Prepara template report finale',
              'Esempio: github.com/juliocesarfort/public-pentesting-reports',
            ],
          },
          {
            date: '2026-07-21',
            label: 'Mar 21 Lug — Mock Exam Day 1',
            hours: '8h',
            tasks: [
              'Simula esame condizioni reali',
              'Macchina pulita',
              'Solo cheatsheet',
              'Nuovo path (lab reset richiesto)',
            ],
          },
        ],
      },
      {
        id: 'w12',
        label: 'Settimana 12',
        range: '22-28 Luglio — Final Prep',
        days: [
          {
            date: '2026-07-22',
            label: 'Mer 22 Lug — Mock Exam Day 2 (the hard one)',
            hours: '8h',
            tasks: [
              'Simula esame, ma con condizioni più dure',
              'Cerca di OWN tutto in 6h invece di 24h',
              'Identifica colli di bottiglia',
            ],
          },
          {
            date: '2026-07-23',
            label: 'Gio 23 Lug — Report mock writing',
            hours: '6h',
            tasks: [
              'Scrivi report del mock exam',
              'Cronometra il tempo di scrittura',
              'Target: report completo in 6-8h',
            ],
          },
          {
            date: '2026-07-24',
            label: 'Ven 24 Lug — Cheatsheet finale',
            hours: '5h',
            tasks: [
              'Versione final-final dei cheatsheet',
              'Stampa o tienili in un singolo PDF',
            ],
          },
          {
            date: '2026-07-25',
            label: 'Sab 25 Lug — Tools test',
            hours: '5h',
            tasks: [
              'Verifica ogni tool funziona ancora',
              'Update PowerView',
              'Update Rubeus',
              'Update Mimikatz',
            ],
          },
          {
            date: '2026-07-26',
            label: 'Dom 26 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-27',
            label: 'Lun 27 Lug — Light study',
            hours: '6h',
            tasks: [
              '3h: review note critiche',
              '3h: video YouTube su CRTP exam tips',
            ],
          },
          {
            date: '2026-07-28',
            label: 'Mar 28 Lug — Ultima ripassata + scheduling',
            tasks: [
              'Schedule esame ufficiale per 17-18 agosto',
              'Esame parte dalle 9 AM tipicamente',
              'Scegli giorno feriale per supporto attivo',
              'Acquista exam attempt se non già incluso',
            ],
          },
        ],
      },
      {
        id: 'w13',
        label: 'Settimana 13',
        range: '29 Luglio - 4 Agosto — Active Recovery ⚠️',
        days: [
          {
            date: '2026-07-29',
            label: 'Mer 29 Lug — Rest Day',
            isRest: true,
            tasks: ['Nessuno studio. Vita reale.'],
          },
          {
            date: '2026-07-30',
            label: 'Gio 30 Lug — Light review',
            hours: '2h',
            tasks: [
              '2h: scorri cheatsheet senza pratica',
              'Resto del giorno: hobby, sport, social',
            ],
          },
          {
            date: '2026-07-31',
            label: 'Ven 31 Lug — Setup ambiente esame',
            hours: '3h',
            tasks: [
              'Prepara fisicamente lo spazio',
              'Sedia comoda',
              'Snack/acqua a portata',
              'Notebook con OS pulito',
              'Backup tools (USB/cloud)',
            ],
          },
          {
            date: '2026-08-01',
            label: 'Sab 1 Ago — Light lab',
            hours: '3h',
            tasks: ['GOAD warmup, niente di nuovo'],
          },
          {
            date: '2026-08-02',
            label: 'Dom 2 Ago — RIPOSO TOTALE',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-08-03',
            label: 'Lun 3 Ago — Visualization',
            hours: '2h',
            tasks: [
              'Simula mentalmente l\'esame',
              'Cosa fai nei primi 30 min?',
              'Cosa fai se sei bloccato?',
            ],
          },
          {
            date: '2026-08-04',
            label: 'Mar 4 Ago — Light review',
            hours: '3h',
            tasks: [
              '3h: cheatsheet finale',
              'NESSUN lab oggi',
            ],
          },
        ],
      },
      {
        id: 'w14',
        label: 'Settimana 14',
        range: '5-11 Agosto — Pre-Exam Week',
        days: [
          {
            date: '2026-08-05',
            label: 'Mer 5 Ago — Mental prep',
            hours: '2h',
            tasks: [
              '2h: leggi report di chi ha passato CRTP',
              'Visualizza scenari positivi',
            ],
          },
          {
            date: '2026-08-06',
            label: 'Gio 6 Ago — Resto',
            isRest: true,
            tasks: ['Resto'],
          },
          {
            date: '2026-08-07',
            label: 'Ven 7 Ago — Last-light run GOAD',
            hours: '3h',
            tasks: ['3h: foothold→DA quick run su GOAD per autostima'],
          },
          {
            date: '2026-08-08',
            label: 'Sab 8 Ago — Riposo + sport',
            isRest: true,
            tasks: ['Riposo + sport'],
          },
          {
            date: '2026-08-09',
            label: 'Dom 9 Ago — Assoluto riposo',
            isRest: true,
            tasks: ['Assoluto riposo'],
          },
          {
            date: '2026-08-10',
            label: 'Lun 10 Ago — Pre-exam day',
            tasks: [
              'Verifica scheduling esame',
              'Test connessione VPN',
              'Conferma slot',
              'NIENTE studio',
              'Sonno presto',
            ],
          },
          {
            date: '2026-08-11',
            label: 'Mar 11 Ago — Light prep day',
            hours: '2h',
            tasks: [
              '2h: cheatsheet review (passive reading)',
              'Riposo',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'fase-4',
    shortLabel: 'Fase 4',
    label: 'Esame e Buffer',
    description: 'EXAM WEEK + Recovery + UOC Setup (12 Agosto - 23 Settembre)',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    weeks: [
      {
        id: 'w15',
        label: 'Settimana 15',
        range: '12-18 Agosto — EXAM WEEK',
        days: [
          {
            date: '2026-08-12',
            label: 'Mer 12 Ago — Pre-exam decompression',
            tasks: [
              'Sport leggero',
              'Pranzo nutriente, no alcol',
              'Sonno alle 22:00',
            ],
          },
          {
            date: '2026-08-13',
            label: 'Gio 13 Ago — D-1',
            tasks: [
              'Mattino: passeggiata, cardio leggero',
              'Pomeriggio: ultimo skim cheatsheet (1h max)',
              'Sera: cucina pasta + verdure',
              'Setup completo workspace',
              'Sonno alle 21:00',
            ],
          },
          {
            date: '2026-08-14',
            label: 'Ven 14 Ago — EXAM DAY 1 🎯',
            hours: '24h',
            tasks: [
              '9:00 AM: inizio esame',
              'Prima ora: lettura attenta dei target (5 server)',
              'Mappa visiva su carta dei target',
              'Ore 1-4: Foothold + Initial Recon',
              'Ore 4-8: Lateral movement',
              'Ore 8-12: Crisis or Continue',
              'Ore 12-16: Sleep window (4-5h)',
              'Ore 16-20: Final push',
              'Ore 20-24: Documentation phase',
            ],
          },
          {
            date: '2026-08-15',
            label: 'Sab 15 Ago — EXAM DAY 2 / Report Day',
            tasks: [
              '9:00 AM: termina lab (24h scadono)',
              'Inizia report (24h-48h disponibili)',
              'Riposo se possibile',
            ],
          },
          {
            date: '2026-08-16',
            label: 'Dom 16 Ago — Report writing',
            hours: '8-10h',
            tasks: [
              'Scrivi report completo',
              'Submit entro mezzanotte',
            ],
          },
          {
            date: '2026-08-17',
            label: 'Lun 17 Ago — Submit + relax',
            tasks: [
              'Verifica submission ricevuta',
              'GIORNATA LIBERA — meritata',
            ],
          },
          {
            date: '2026-08-18',
            label: 'Mar 18 Ago — Relax + comincia attesa',
            tasks: ['Aspetta risposta (1-2 settimane)'],
          },
        ],
      },
      {
        id: 'w16',
        label: 'Settimana 16',
        range: '19-25 Agosto — Recovery + scenario A/B',
        days: [
          {
            date: '2026-08-19',
            label: 'Mer 19 Ago — Recovery day',
            tasks: [
              'Riposo',
              'Aspetta risultato',
            ],
          },
          {
            date: '2026-08-20',
            label: 'Gio 20 Ago — Recovery',
            tasks: ['Recovery + light activity'],
          },
          {
            date: '2026-08-21',
            label: 'Ven 21 Ago — Recovery',
            tasks: ['Recovery'],
          },
          {
            date: '2026-08-22',
            label: 'Sab 22 Ago — Scenario A/B',
            tasks: [
              'Se hai passato: aggiorna LinkedIn con cert CRTP',
              'Se hai passato: scrivi blog post "My CRTP Journey"',
              'Se hai passato: inizia setup pre-OSCP (light)',
              'Se hai fallito: cooldown obbligatorio 1 mese',
              'Se hai fallito: identifica cosa è andato storto via feedback',
            ],
          },
          {
            date: '2026-08-23',
            label: 'Dom 23 Ago — Riposo',
            isRest: true,
            tasks: ['Riposo'],
          },
          {
            date: '2026-08-24',
            label: 'Lun 24 Ago — Skill maintenance',
            tasks: ['HackTheBox: 1 box AD/Windows ogni 2-3 giorni'],
          },
          {
            date: '2026-08-25',
            label: 'Mar 25 Ago — Light study',
            tasks: ['Blog tecnico: scrivi articolo'],
          },
        ],
      },
      {
        id: 'w17',
        label: 'Settimana 17',
        range: '26 Agosto - 1 Settembre — Skill Maintenance',
        days: [
          {
            date: '2026-08-26',
            label: 'Mer 26 Ago — HTB box',
            tasks: ['HackTheBox: 1 box AD/Windows'],
          },
          {
            date: '2026-08-27',
            label: 'Gio 27 Ago — Light',
            tasks: ['Blog tecnico'],
          },
          {
            date: '2026-08-28',
            label: 'Ven 28 Ago — HTB box',
            tasks: ['HackTheBox: 1 box AD/Windows'],
          },
          {
            date: '2026-08-29',
            label: 'Sab 29 Ago — LinkedIn',
            tasks: ['LinkedIn: condividi journey'],
          },
          {
            date: '2026-08-30',
            label: 'Dom 30 Ago — Riposo',
            isRest: true,
            tasks: ['Riposo'],
          },
          {
            date: '2026-08-31',
            label: 'Lun 31 Ago — HTB box',
            tasks: ['HackTheBox: 1 box AD/Windows'],
          },
          {
            date: '2026-09-01',
            label: 'Mar 1 Set — Blog',
            tasks: ['Blog tecnico: scrivi 2° articolo'],
          },
        ],
      },
      {
        id: 'w18',
        label: 'Settimana 18',
        range: '2-8 Settembre — Skill Maintenance',
        days: [
          {
            date: '2026-09-02',
            label: 'Mer 2 Set — HTB box',
            tasks: ['HackTheBox: 1 box AD/Windows'],
          },
          {
            date: '2026-09-03',
            label: 'Gio 3 Set — Light',
            tasks: ['Light review'],
          },
          {
            date: '2026-09-04',
            label: 'Ven 4 Set — HTB box',
            tasks: ['HackTheBox: 1 box AD/Windows'],
          },
          {
            date: '2026-09-05',
            label: 'Sab 5 Set — Light',
            tasks: ['Read tech blogs'],
          },
          {
            date: '2026-09-06',
            label: 'Dom 6 Set — Riposo',
            isRest: true,
            tasks: ['Riposo'],
          },
          {
            date: '2026-09-07',
            label: 'Lun 7 Set — HTB box',
            tasks: ['HackTheBox: 1 box AD/Windows'],
          },
          {
            date: '2026-09-08',
            label: 'Mar 8 Set — Light',
            tasks: ['Cervello deve riposare', 'NIENTE nuove certificazioni'],
          },
        ],
      },
      {
        id: 'w19',
        label: 'Settimana 19',
        range: '9-22 Settembre — UOC Setup',
        days: [
          {
            date: '2026-09-09',
            label: 'Mer 9 Set — UOC Setup',
            tasks: [
              'Verifica accesso campus virtual UOC',
              'Materiali corso scaricati',
            ],
          },
          {
            date: '2026-09-10',
            label: 'Gio 10 Set — Setup C',
            tasks: ['Setup ambiente C su Mac (brew install gcc valgrind)'],
          },
          {
            date: '2026-09-11',
            label: 'Ven 11 Set — Calendario UOC',
            tasks: ['Calendario UOC + integrazione con il tuo system'],
          },
          {
            date: '2026-09-12',
            label: 'Sab 12 Set — Light',
            tasks: ['Light prep'],
          },
          {
            date: '2026-09-13',
            label: 'Dom 13 Set — Riposo',
            isRest: true,
            tasks: ['Riposo'],
          },
          {
            date: '2026-09-14',
            label: 'Lun 14 Set — UOC Materials',
            tasks: ['Studia materiali UOC'],
          },
          {
            date: '2026-09-15',
            label: 'Mar 15 Set — UOC Materials',
            tasks: ['Studia materiali UOC'],
          },
          {
            date: '2026-09-16',
            label: 'Mer 16 Set — UOC Materials',
            tasks: ['Studia materiali UOC'],
          },
          {
            date: '2026-09-17',
            label: 'Gio 17 Set — UOC Materials',
            tasks: ['Studia materiali UOC'],
          },
          {
            date: '2026-09-18',
            label: 'Ven 18 Set — UOC Final prep',
            tasks: ['Final prep UOC'],
          },
          {
            date: '2026-09-19',
            label: 'Sab 19 Set — Light',
            tasks: ['Light review'],
          },
          {
            date: '2026-09-20',
            label: 'Dom 20 Set — Riposo',
            isRest: true,
            tasks: ['Riposo'],
          },
          {
            date: '2026-09-21',
            label: 'Lun 21 Set — Last day before UOC',
            tasks: ['Ultimo giorno di prep'],
          },
          {
            date: '2026-09-22',
            label: 'Mar 22 Set — Day before UOC',
            tasks: ['Final preparation', 'Sonno presto'],
          },
        ],
      },
    ],
  },
];

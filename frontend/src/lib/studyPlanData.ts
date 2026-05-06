// CPTS Study Plan — Roadmap 12 settimane parsata dal file markdown
// Date: 6 Maggio 2026 → 31 Luglio 2026 (lab phase) + 1-7 Agosto (report phase)

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

export const CPTS_PLAN: StudyPhaseSeed[] = [
  {
    id: 'phase-setup',
    shortLabel: 'Setup',
    label: 'Setup veloce + Mod 1-5',
    description: 'Settimana 1 — sub HTB Academy, notebook, Penetration Testing Process, Nmap, Footprinting, Web Recon, Vuln Assessment',
    color: 'text-slate-300',
    bg: 'bg-slate-500/10 border-slate-500/20',
    weeks: [
      {
        id: 'w1',
        label: 'Settimana 1',
        range: '6-12 Maggio — Setup + Modulo 1-5',
        days: [
          {
            date: '2026-05-06',
            label: 'Mer 6 Mag — Decision Day ✅',
            tasks: [
              'Decisione roadmap CPTS confermata (pivot da CRTP)',
              'Pagina Notion 🗺️ 10-Roadmap-Cert-2026 creata',
              'PCE UNED cancellati (no conflict scheduling)',
              'Lock decisione fino a Settembre 2026',
            ],
          },
          {
            date: '2026-05-07',
            label: 'Gio 7 Mag — Sub HTB Academy + Setup notebook + Modulo 1',
            hours: '~6h',
            tasks: [
              'Mattino (1h): HTB Academy → upgrade sub (Student ~$8/mese o Silver ~$50/mese)',
              'Verifica eligibility CPTS exam: serve sub livello adeguato + cubes per voucher',
              'Mattino (30min): setup notebook ~/cpts-notes/ su Kali con struttura ufficiale',
              'Pomeriggio (4h): Modulo 1 — Penetration Testing Process (15 sezioni)',
              'PTES methodology, pre-engagement, contract, scope, RoE, phase breakdown',
              'Tutte le questions del modulo',
              'Sera (1h): note in 01-pen-test-process/ — è IL framework del path',
              'Self-test: posso descrivere a voce ogni fase di un pentest professionale',
            ],
          },
          {
            date: '2026-05-08',
            label: 'Ven 8 Mag — Mod 2 (Nmap review) + Mod 3 inizio (Footprinting)',
            hours: '7h',
            tasks: [
              'Mattino (3h): Modulo 2 — Network Enumeration with Nmap (12 sezioni)',
              'Per te è ripasso, vai veloce, completa tutte le questions',
              'Note minime su 02-network-enum-nmap/ solo per gap nuovi',
              'Pomeriggio (4h): Modulo 3 — Footprinting (sezioni 1-15)',
              'DNS, SMB, NFS, FTP enumeration',
              'Pratica su HTB lab + GOAD',
              'Note in 03-footprinting/',
            ],
          },
          {
            date: '2026-05-09',
            label: 'Sab 9 Mag — Mod 3 chiusura + Write-up #1',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 3 — Footprinting (sezioni 16-33)',
              'LDAP, RPC, SNMP, MySQL/MSSQL, Oracle, IPMI',
              'Tutte le questions',
              'Pomeriggio (3h): Write-up blog #1',
              'Title: "GOAD Day 1: Password Spray, AS-REP Roast & Kerberoast End-to-End"',
              'Sanitized, pubblicato su blog (Medium o GitHub Pages)',
              'Linka da LinkedIn + HTB profile',
            ],
          },
          {
            date: '2026-05-10',
            label: 'Dom 10 Mag — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale — domenica sacra'],
          },
          {
            date: '2026-05-11',
            label: 'Lun 11 Mag — Mod 4 (Web Recon) + Box CTF #1',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 4 — Information Gathering Web Edition (19 sezioni)',
              'Web recon completo, DNS recon, archives, fingerprint',
              'Tutte le questions',
              'Pomeriggio (3h): HTB main platform — Box CTF #1 (Easy Linux)',
              'Time-box 3h, walkthrough OK se non finisci',
              'Note + screenshot in 99-htb-boxes/box-N-name.md',
            ],
          },
          {
            date: '2026-05-12',
            label: 'Mar 12 Mag — Mod 5 (Vuln Assessment) + Diario settimana',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 5 — Vulnerability Assessment (10 sezioni)',
              'CVSS, CVE, exploit-db, Nessus/OpenVAS basics',
              'Tutte le questions',
              'Pomeriggio (3h): Diario settimana + planning Sett 2',
              'Recap moduli 1-5 done + cheatsheet update',
              'Self-assessment: moduli 1-5 al 100%, sub HTB attivo, 1 box risolta, 1 blog post',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'phase-a',
    shortLabel: 'Blocco A',
    label: 'Recon + Exploitation Basics',
    description: 'Sett 2-3 — Mod 6-12. File Transfers, Shells, MSF, Password Attacks, Common Services, Pivoting, AD Enum & Attacks ⭐',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    weeks: [
      {
        id: 'w2',
        label: 'Settimana 2',
        range: '13-19 Maggio — Mod 6-11 (Shells, MSF, Password, Services)',
        days: [
          {
            date: '2026-05-13',
            label: 'Mer 13 Mag — Mod 6 (File Transfers) + Mod 7 inizio (Shells)',
            hours: '6h',
            tasks: [
              'Mattino (2h): Modulo 6 — File Transfers (12 sezioni)',
              'Linux↔Windows transfer methods, LOLBins',
              'Veloce, modulo "tactical"',
              'Pomeriggio (4h): Modulo 7 — Shells & Payloads (sezioni 1-14)',
              'Bind/reverse shells, msfvenom basics',
            ],
          },
          {
            date: '2026-05-14',
            label: 'Gio 14 Mag — Mod 7 chiusura + Mod 8 (MSF review)',
            hours: '7h',
            tasks: [
              'Mattino (3h): Modulo 7 — Shells & Payloads (sezioni 15-28)',
              'Pomeriggio (4h): Modulo 8 — Using the Metasploit Framework (18 sezioni)',
              'Veloce sezioni 1-12 (basics, ripasso strutturato)',
              'Più attento 13-18 (post modules, evasion)',
              'Tutte le questions',
            ],
          },
          {
            date: '2026-05-15',
            label: 'Ven 15 Mag — Mod 9 (Password Attacks) parte 1 + Box CTF #2',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 9 — Password Attacks (sezioni 1-13)',
              'Hash types, hashcat, john',
              'Pratica con hash da GOAD',
              'Pomeriggio (3h): Box CTF #2 (Easy Windows) — HTB main, time-box 3h',
            ],
          },
          {
            date: '2026-05-16',
            label: 'Sab 16 Mag — Mod 9 chiusura + Mod 10 inizio',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 9 — Password Attacks (sezioni 14-26)',
              'Rules, mask attacks, online attacks',
              'Pomeriggio (3h): Modulo 10 — Attacking Common Services (sezioni 1-10)',
              'FTP, SMB, NFS attacks',
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
            label: 'Lun 18 Mag — Mod 10 chiusura + Write-up #2',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 10 — Attacking Common Services (sezioni 11-19)',
              'SQL services, RDP, WinRM',
              'Pomeriggio (3h): Write-up blog #2',
              'Title: "Service Enumeration Cheat Sheet: From Nmap to Exploit"',
              'High-value content per HR pentest',
            ],
          },
          {
            date: '2026-05-19',
            label: 'Mar 19 Mag — Mod 11 inizio (Pivoting) ⭐',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 11 — Pivoting, Tunneling, Port Forwarding (sezioni 1-9)',
              'SSH tunneling, SOCKS, chisel',
              '⭐ Gap importante per te — vai lento',
              'Pomeriggio (3h): pratica pivoting su lab GOAD (multi-hop tunnel)',
            ],
          },
        ],
      },
      {
        id: 'w3',
        label: 'Settimana 3',
        range: '20-26 Maggio — Pivoting + AD Module ⭐⭐⭐',
        days: [
          {
            date: '2026-05-20',
            label: 'Mer 20 Mag — Mod 11 chiusura',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 11 — Pivoting (sezioni 10-18)',
              'msf pivoting, dnscat2, ICMP tunnel',
              'Tutte le questions',
              'Pomeriggio (3h): pratica pivoting su HTB lab + GOAD',
              'Setup chisel + ligolo-ng su Hetzner come "external attacker"',
              'Sera: cheatsheet 99-cheatsheets/pivoting-tunneling.md',
            ],
          },
          {
            date: '2026-05-21',
            label: 'Gio 21 Mag — Mod 12 (AD Enum & Attacks) sez 1-7',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 12 — AD Enumeration & Attacks (sezioni 1-7)',
              'AD basics rivisti + initial enumeration',
              'Per te è consolidamento (hai già fatto end-to-end su GOAD)',
              'Pomeriggio (3h): cross-reference con ~/crtp-notes/',
              'Note doppie spostate in ~/cpts-notes/12-ad-enum-attacks/',
            ],
          },
          {
            date: '2026-05-22',
            label: 'Ven 22 Mag — Mod 12 sez 8-14 + Box CTF #3 (AD)',
            hours: '6h',
            tasks: [
              'Mattino (3h): ACL abuse, Kerberoasting (rivisto), AS-REP roasting',
              'Pomeriggio (3h): Box CTF #3 — Medium AD box',
              'HTB main platform, scegli box AD-flavored',
              'Time-box 4h, walkthrough OK se bloccato',
            ],
          },
          {
            date: '2026-05-23',
            label: 'Sab 23 Mag — Mod 12 sez 15-21 + GOAD pratica',
            hours: '7h',
            tasks: [
              'Mattino (4h): lateral movement (PtH, PtT, OverPtH), trust attacks',
              'Pomeriggio (3h): pratica intensa su GOAD',
              'Replica gli attacchi del modulo, verifica edge BloodHound',
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
            label: 'Lun 25 Mag — Mod 12 sez 22-28 + Write-up #3a (AD serie)',
            hours: '7h',
            tasks: [
              'Mattino (4h): persistence, GPO abuse, ADCS basics, BloodHound advanced',
              'Tutte le questions del modulo 12',
              'Pomeriggio (3h): Write-up blog #3a (serie AD pentest)',
              'Title: "Active Directory Pentest Series Part 1: Recon to Foothold"',
              'Foundation della serie 3-4 post',
            ],
          },
          {
            date: '2026-05-26',
            label: 'Mar 26 Mag — Buffer + Box CTF #4 (AD)',
            hours: '6h',
            tasks: [
              'Mattino (3h): ripasso modulo 12 weak spots',
              'Pomeriggio (3h): Box CTF #4 — altra box AD medium',
              'Sera: cheatsheet ad-attacks.md consolidato',
              'Self-assessment: moduli 1-12 al 100% (50% del path), AD consolidato',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'phase-b',
    shortLabel: 'Blocco B',
    label: 'Web App Attacks',
    description: 'Sett 4-6 — Mod 13-23. IL GAP più grosso. Burp, Ffuf, Login Brute, SQLi, XSS, LFI, File Upload, Cmd Inj, Web Attacks, Common Apps',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    weeks: [
      {
        id: 'w4',
        label: 'Settimana 4',
        range: '27 Maggio - 2 Giugno — Web Foundations',
        days: [
          {
            date: '2026-05-27',
            label: 'Mer 27 Mag — Mod 13 (Web Proxies) + Mod 14 inizio (Ffuf)',
            hours: '7h',
            tasks: [
              'Mattino (3h): Modulo 13 — Using Web Proxies (12 sezioni)',
              'Burp Suite mastery, OWASP ZAP basics',
              'Pomeriggio (4h): Modulo 14 — Attacking Web Apps with Ffuf (sezioni 1-7)',
              'Directory busting, parameter fuzzing',
              'Pratica su HTB lab',
            ],
          },
          {
            date: '2026-05-28',
            label: 'Gio 28 Mag — Mod 14 chiusura + Mod 15 (Login Brute)',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 14 — Ffuf (sezioni 8-15) + questions',
              'Pomeriggio (3h): Modulo 15 — Login Brute Forcing (11 sezioni)',
              'Hydra, Burp Intruder, custom scripts',
              'Veloce, modulo focused',
            ],
          },
          {
            date: '2026-05-29',
            label: 'Ven 29 Mag — Mod 16 (SQLi Fundamentals)',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 16 — SQL Injection Fundamentals (sezioni 1-8)',
              'UNION-based, error-based, blind',
              'Manual SQLi senza tool',
              'Pomeriggio (3h): pratica SQLi manuale su lab DVWA + HTB',
            ],
          },
          {
            date: '2026-05-30',
            label: 'Sab 30 Mag — Mod 16 chiusura + Mod 17 (SQLMap)',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 16 — SQLi Fundamentals (sezioni 9-16) + questions',
              'Pomeriggio (3h): Modulo 17 — SQLMap Essentials (11 sezioni)',
              'Automation, tampering, WAF bypass',
              'Tutte le questions',
            ],
          },
          {
            date: '2026-05-31',
            label: 'Dom 31 Mag — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-01',
            label: 'Lun 1 Giu — Box CTF #5 + Write-up #4 (SQLi manual)',
            hours: '7h',
            tasks: [
              'Mattino (4h): Box CTF #5 — Medium Web box (HTB main)',
              'Pomeriggio (3h): Write-up blog #4',
              'Title: "Manual SQL Injection Without SQLMap: A Step-by-Step Guide"',
              'High-value, manual SQLi è skill che recruiter apprezza',
            ],
          },
          {
            date: '2026-06-02',
            label: 'Mar 2 Giu — Mod 18 (XSS) parte 1',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 18 — Cross-Site Scripting (sezioni 1-9)',
              'Reflected, stored, DOM XSS',
              'Pomeriggio (3h): pratica XSS su lab + PortSwigger Academy (free)',
            ],
          },
        ],
      },
      {
        id: 'w5',
        label: 'Settimana 5',
        range: '3-9 Giugno — Web Vulns Core (XSS, LFI, Upload, CmdInj, Web Attacks)',
        days: [
          {
            date: '2026-06-03',
            label: 'Mer 3 Giu — Mod 18 chiusura + Mod 19 inizio (LFI)',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 18 — XSS (sezioni 10-17) + questions',
              'Pomeriggio (3h): Modulo 19 — File Inclusion (sezioni 1-7)',
              'LFI, RFI, PHP wrappers',
            ],
          },
          {
            date: '2026-06-04',
            label: 'Gio 4 Giu — Mod 19 chiusura + Mod 20 (File Upload)',
            hours: '6h',
            tasks: [
              'Mattino (3h): Modulo 19 — File Inclusion (sezioni 8-13) + log poisoning',
              'Pomeriggio (3h): Modulo 20 — File Upload Attacks (14 sezioni)',
              'Bypass technique, PHP/ASP/JSP webshell',
              'Tutte le questions',
            ],
          },
          {
            date: '2026-06-05',
            label: 'Ven 5 Giu — Mod 21 (Cmd Inj) + Mod 22 inizio (Web Attacks)',
            hours: '6h',
            tasks: [
              'Mattino (2h): Modulo 21 — Command Injections (10 sezioni) — modulo veloce',
              'Pomeriggio (4h): Modulo 22 — Web Attacks (sezioni 1-7)',
              'IDOR, XXE, SSRF, deserialization',
            ],
          },
          {
            date: '2026-06-06',
            label: 'Sab 6 Giu — Mod 22 chiusura + Box CTF #6 (Hard Web)',
            hours: '7h',
            tasks: [
              'Mattino (3h): Modulo 22 — Web Attacks (sezioni 8-13) + questions',
              'Pomeriggio (4h): Box CTF #6 — Hard Web box',
              'Time-box 4h, walkthrough se bloccato',
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
            label: 'Lun 8 Giu — Write-up #5 (Top 10 Web) + Mod 23 inizio',
            hours: '7h',
            tasks: [
              'Mattino (3h): Write-up blog #5',
              'Title: "Top 10 Web Vulnerabilities Hands-On: From Theory to Exploitation"',
              'Master post consolidato XSS+SQLi+LFI+SSRF+XXE',
              'Pomeriggio (4h): Modulo 23 — Attacking Common Applications (sezioni 1-11)',
              'WordPress, Joomla, Drupal',
            ],
          },
          {
            date: '2026-06-09',
            label: 'Mar 9 Giu — Mod 23 parte 2 + pratica HTB',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 23 (sezioni 12-22)',
              'Tomcat, Jenkins, JBoss',
              'Pomeriggio (3h): pratica HTB box',
            ],
          },
        ],
      },
      {
        id: 'w6',
        label: 'Settimana 6',
        range: '10-16 Giugno — Common Apps + AD review + Linux PrivEsc inizio',
        days: [
          {
            date: '2026-06-10',
            label: 'Mer 10 Giu — Mod 23 chiusura',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 23 (sezioni 23-33)',
              'Splunk, Gitea, custom apps',
              'Tutte le questions',
              'Pomeriggio (3h): pratica HTB box (medium app)',
            ],
          },
          {
            date: '2026-06-11',
            label: 'Gio 11 Giu — Buffer Web + Box CTF #7',
            hours: '7h',
            tasks: [
              'Mattino (3h): ripasso moduli web 13-23, identifica weak spots',
              'Pomeriggio (4h): Box CTF #7 — Web-heavy box',
            ],
          },
          {
            date: '2026-06-12',
            label: 'Ven 12 Giu — AD pratica avanzata su GOAD',
            hours: '6h',
            tasks: [
              '6h: sessione GOAD intensiva per consolidare AD module',
              'Ricomincia da utente low-priv',
              'Esegui chain: enum → Kerberoast → lateral → DA',
              'Documenta come fosse esame',
              'Sera: write-up serie AD #3b',
            ],
          },
          {
            date: '2026-06-13',
            label: 'Sab 13 Giu — Box CTF #8 (Insane AD)',
            hours: '6h',
            tasks: [
              '6h: Box CTF #8 — Insane AD box (HTB main)',
              'Senza walkthrough first 4h',
              'Walkthrough ammesso solo se completamente bloccato',
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
            label: 'Lun 15 Giu — Write-up #3c (AD Lateral) + buffer',
            hours: '7h',
            tasks: [
              'Mattino (4h): Write-up blog #6',
              'Title: "Active Directory Pentest Part 2: Lateral Movement & Privilege Escalation"',
              'Lab GOAD walkthrough advanced',
              'Pomeriggio (3h): ripasso settimana',
            ],
          },
          {
            date: '2026-06-16',
            label: 'Mar 16 Giu — Mod 24 inizio (Linux PrivEsc)',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 24 — Linux Privilege Escalation (sezioni 1-10)',
              'SUID/SGID, sudo abuse, capabilities',
              'Pomeriggio (3h): pratica HTB privesc box (linenum + linpeas systematic)',
              'Self-assessment: moduli 1-23 al 100% (path 80%), Mod 24 al 30%',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'phase-c',
    shortLabel: 'Blocco C',
    label: 'Privilege Escalation Mastery',
    description: 'Sett 7-8 — Mod 24-25. Linux + Windows PrivEsc deep. Moduli più tested in CPTS exam dopo AD',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    weeks: [
      {
        id: 'w7',
        label: 'Settimana 7',
        range: '17-23 Giugno — Linux PrivEsc deep',
        days: [
          {
            date: '2026-06-17',
            label: 'Mer 17 Giu — Mod 24 parte 2',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 24 (sezioni 11-19)',
              'Cron jobs, kernel exploits, NFS no_root_squash',
              'Pomeriggio (3h): pratica linenum + linpeas su HTB',
            ],
          },
          {
            date: '2026-06-18',
            label: 'Gio 18 Giu — Mod 24 parte 3 (chiusura)',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 24 (sezioni 20-28)',
              'Container escape, advanced',
              'Tutte le questions',
              'Pomeriggio (3h): cheatsheet linwin-privesc.md (parte Linux)',
            ],
          },
          {
            date: '2026-06-19',
            label: 'Ven 19 Giu — Box CTF #9 + #10 (Linux focus)',
            hours: '8h',
            tasks: [
              'Tutto giorno: 2 box HTB Linux con focus privesc',
              'Box #9: Linux medium',
              'Box #10: Linux hard (con walkthrough OK se bloccato)',
            ],
          },
          {
            date: '2026-06-20',
            label: 'Sab 20 Giu — Write-up #7 Linux PrivEsc',
            hours: '7h',
            tasks: [
              'Mattino (4h): Write-up blog #7',
              'Title: "Linux Privilege Escalation Methodology: A Practical Guide"',
              'HIGH-VALUE content per HR',
              'Pomeriggio (3h): pratica extra su lab GOAD (Linux side se ce n\'è)',
            ],
          },
          {
            date: '2026-06-21',
            label: 'Dom 21 Giu — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-22',
            label: 'Lun 22 Giu — Mod 25 inizio (Win PrivEsc) ⭐⭐',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 25 — Windows PrivEsc (sezioni 1-12)',
              'Token manipulation, UAC bypass intro',
              'Pomeriggio (3h): pratica WinPEAS + PowerUp su Win11 VM',
            ],
          },
          {
            date: '2026-06-23',
            label: 'Mar 23 Giu — Mod 25 parte 2',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 25 (sezioni 13-25)',
              'DLL hijacking, unquoted service paths',
              'SeImpersonatePrivilege family',
              'Pomeriggio (3h): pratica box HTB Windows',
            ],
          },
        ],
      },
      {
        id: 'w8',
        label: 'Settimana 8',
        range: '24-30 Giugno — Windows PrivEsc + buffer',
        days: [
          {
            date: '2026-06-24',
            label: 'Mer 24 Giu — Mod 25 parte 3',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 25 (sezioni 26-35)',
              'Print Nightmare, PrintSpoofer family',
              'Service abuse advanced',
              'Pomeriggio (3h): pratica intensa Win VM (vulnerable lab setup)',
            ],
          },
          {
            date: '2026-06-25',
            label: 'Gio 25 Giu — Mod 25 chiusura',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 25 (sezioni 36-end)',
              'Tutte le questions',
              'Pomeriggio (3h): cheatsheet linwin-privesc.md (parte Windows)',
            ],
          },
          {
            date: '2026-06-26',
            label: 'Ven 26 Giu — Box CTF #11 + #12 (Windows focus)',
            hours: '8h',
            tasks: [
              'Tutto giorno: 2 box HTB Windows medium/hard',
              'Focus privesc',
              'Documenta come scenario reale',
            ],
          },
          {
            date: '2026-06-27',
            label: 'Sab 27 Giu — Write-up #8 Windows PrivEsc',
            hours: '7h',
            tasks: [
              'Mattino (4h): Write-up blog #8',
              'Title: "Windows Privilege Escalation: Service Abuse, DLL Hijacking, and Token Theft"',
              'Pomeriggio (3h): ripasso weak spots tutto BLOCCO C',
            ],
          },
          {
            date: '2026-06-28',
            label: 'Dom 28 Giu — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-06-29',
            label: 'Lun 29 Giu — Buffer + Box CTF #13 (Hard mixed)',
            hours: '8h',
            tasks: [
              'Mattino (4h): ripasso AD + privesc combinati',
              'Pomeriggio (4h): Box CTF #13 — Hard mixed (web + privesc + AD)',
            ],
          },
          {
            date: '2026-06-30',
            label: 'Mar 30 Giu — Buffer + planning Reporting',
            hours: '6h',
            tasks: [
              'Mattino (3h): ripasso settimana + cheatsheet update',
              'Pomeriggio (3h): setup mentale per modulo 26 (Reporting)',
              'Sera: review honest progresso vs plan',
              'Self-assessment: moduli 1-25 al 100% (path 90%), privesc Linux+Win confident',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'phase-d',
    shortLabel: 'Blocco D',
    label: 'Reporting + Final Boss + Mock',
    description: 'Sett 9-11 — Mod 26 (Reporting ⭐⭐⭐ 50% del voto) + Mod 27 (Attacking Enterprise Networks FINAL BOSS) + Mock Exam interno',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    weeks: [
      {
        id: 'w9',
        label: 'Settimana 9',
        range: '1-7 Luglio — Documentation & Reporting ⭐⭐⭐',
        days: [
          {
            date: '2026-07-01',
            label: 'Mer 1 Lug — Mod 26 parte 1 (Reporting)',
            hours: '7h',
            tasks: [
              '🎯 MODULO CRITICO. 50% DEL VOTO ESAME È IL REPORT.',
              'Mattino (4h): Modulo 26 — Documentation & Reporting (sezioni 1-7)',
              'Report structure, executive summary',
              'Pomeriggio (3h): studio template ufficiali (TCM, public pentest reports gallery)',
            ],
          },
          {
            date: '2026-07-02',
            label: 'Gio 2 Lug — Mod 26 parte 2 (chiusura)',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 26 (sezioni 8-15)',
              'Finding writeup, screenshot, evidence chain',
              'Tutte le questions',
              'Pomeriggio (3h): scrivi template 99-cheatsheets/reporting-template.md',
            ],
          },
          {
            date: '2026-07-03',
            label: 'Ven 3 Lug — Practice Report #1',
            hours: '7h',
            tasks: [
              'Tutto giorno: scrivi un report PRATICO completo su Box #8 (AD insane) o equivalente già risolta',
              'Esegui di nuovo la box, questa volta documenti come per cliente',
              'Output: PDF report 20-30 pagine',
            ],
          },
          {
            date: '2026-07-04',
            label: 'Sab 4 Lug — Practice Report #2 (revisione + upgrade)',
            hours: '8h',
            tasks: [
              'Mattino (4h): revisiona report #1, identifica weak spots',
              'Pomeriggio (4h): scrivi report #2 su altra box (Linux PrivEsc focus)',
            ],
          },
          {
            date: '2026-07-05',
            label: 'Dom 5 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-06',
            label: 'Lun 6 Lug — Write-up #9 reporting + mock setup',
            hours: '7h',
            tasks: [
              'Mattino (3h): Write-up blog #9',
              'Title: "How to Write a Penetration Test Report That Doesn\'t Suck"',
              'Sanitized version del tuo template',
              'Pomeriggio (4h): setup mentale modulo 27 + scegli box per mock',
            ],
          },
          {
            date: '2026-07-07',
            label: 'Mar 7 Lug — Mod 27 inizio (Attacking Enterprise Networks)',
            hours: '7h',
            tasks: [
              'Mattino (4h): Modulo 27 — Attacking Enterprise Networks (parte 1)',
              'Lettura + setup',
              'Questo modulo è simulazione end-to-end pentest',
              'Pomeriggio (3h): continua sezioni iniziali',
            ],
          },
        ],
      },
      {
        id: 'w10',
        label: 'Settimana 10',
        range: '8-14 Luglio — Attacking Enterprise Networks ⭐⭐⭐ FINAL BOSS',
        days: [
          {
            date: '2026-07-08',
            label: 'Mer 8 Lug — Mod 27 parte 2 (Recon esterno + Foothold)',
            hours: '8h',
            tasks: [
              'Tutto giorno: Modulo 27 sezioni medie',
              'Recon esterno → foothold via web/service',
              'Documenta TUTTO come fosse esame',
            ],
          },
          {
            date: '2026-07-09',
            label: 'Gio 9 Lug — Mod 27 parte 3 (Internal recon + Lateral)',
            hours: '8h',
            tasks: [
              'Tutto giorno: internal recon + lateral movement',
              'AD attacks chain',
              'Pivoting',
            ],
          },
          {
            date: '2026-07-10',
            label: 'Ven 10 Lug — Mod 27 parte 4 (Domain compromise + Persistence)',
            hours: '8h',
            tasks: [
              'Tutto giorno: domain compromise + persistence',
              'Push verso DA',
              'Tutte le questions del modulo',
            ],
          },
          {
            date: '2026-07-11',
            label: 'Sab 11 Lug — Report Mod 27 (commercial-grade)',
            hours: '8h',
            tasks: [
              'Tutto giorno: scrivi REPORT COMPLETO su quello che hai fatto modulo 27',
              'Stile commercial-grade',
              '30-40 pagine target',
              'Diagrammi attack path',
            ],
          },
          {
            date: '2026-07-12',
            label: 'Dom 12 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-13',
            label: 'Lun 13 Lug — Write-up #10 + mock prep',
            hours: '7h',
            tasks: [
              'Mattino (4h): Write-up blog #10',
              'Title: "End-to-End Active Directory Pentest: From External to Domain Admin"',
              'Sanitized version modulo 27 simulation',
              'Pomeriggio (3h): prep mock exam interno',
            ],
          },
          {
            date: '2026-07-14',
            label: 'Mar 14 Lug — Buffer + check readiness',
            hours: '7h',
            tasks: [
              'Mattino (3h): review honest:',
              'Tutti i 27 moduli al 100% su HTB Academy?',
              '2-3 report pratici scritti? Cheatsheets master complete?',
              'HTB profile: 13+ box risolte? Blog: 10+ post?',
              'Pomeriggio (4h): identifica e chiudi GAP',
              'Self-assessment: path 100% — eligible for exam!',
            ],
          },
        ],
      },
      {
        id: 'w11',
        label: 'Settimana 11',
        range: '15-21 Luglio — Mock Exam interno + Pwnbox + Pre-exam',
        days: [
          {
            date: '2026-07-15',
            label: 'Mer 15 Lug — START Mock Exam (24h time-box)',
            hours: '12h',
            tasks: [
              '🎯 Simulazione esame vera.',
              '9:00 AM: scegli HTB box hard tier che NON hai mai fatto (ideal: AD/Enterprise flavored)',
              '24h time-box: simula esame vero',
              'No walkthrough',
              'Documenta come per esame',
              'Internet/AI permessi (è regola CPTS)',
              'Stop alle 9:00 AM giovedì 16 Lug',
            ],
          },
          {
            date: '2026-07-16',
            label: 'Gio 16 Lug — Mock report writing (start)',
            hours: '10h',
            tasks: [
              '9:00 AM - 21:00: inizio report mock',
              'Outline + executive summary',
              'Detailed findings parte 1',
            ],
          },
          {
            date: '2026-07-17',
            label: 'Ven 17 Lug — Mock report (chiusura)',
            hours: '10h',
            tasks: [
              'Tutto giorno: completa report',
              'Findings dettagliate',
              'Attack path diagram',
              'Recommendations',
              'Submit (a te stesso/Claude per review)',
            ],
          },
          {
            date: '2026-07-18',
            label: 'Sab 18 Lug — Mock review',
            hours: '7h',
            tasks: [
              'Mattino (4h): confronta tuo writeup con writeup ufficiale della box',
              'Pomeriggio (3h): identifica gap nel mock + plan recovery',
            ],
          },
          {
            date: '2026-07-19',
            label: 'Dom 19 Lug — RIPOSO',
            isRest: true,
            tasks: ['Riposo totale'],
          },
          {
            date: '2026-07-20',
            label: 'Lun 20 Lug — Pwnbox setup + last gap closure',
            hours: '7h',
            tasks: [
              'Mattino (3h): setup Pwnbox su HTB',
              'Decidi se userai Pwnbox o tua Kali via VPN per esame',
              'Raccomandazione: Pwnbox (zero rischio config, ambient garantito)',
              'Familiarizza con Pwnbox usando una box pratica',
              'Pomeriggio (4h): chiudi GAP identificati dal mock',
            ],
          },
          {
            date: '2026-07-21',
            label: 'Mar 21 Lug — Pre-exam buffer + scheduling',
            hours: '6h',
            tasks: [
              'Mattino (3h): schedula esame su portale HTB Academy per 22-31 Luglio',
              'Suggerimento: inizio Mer 22 Lug → finisci lab entro 28, report entro 4 Ago',
              'Pomeriggio (3h): cheatsheet final review',
              'Sera: checklist pre-esame (HackTricks offline, PayloadsAllTheThings, tool standard testati)',
              'Self-assessment: mock completato, Pwnbox familiare, esame schedulato, zero gap critici',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'phase-e',
    shortLabel: 'Blocco E',
    label: 'ESAME (Lab + Report)',
    description: 'Sett 12 (22-28 Lug Lab phase) + Sett 13 (29 Lug - 4 Ago Report phase). Format CPTS: 7gg lab + 7gg report. Internet & AI permessi.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    weeks: [
      {
        id: 'w12',
        label: 'Settimana 12',
        range: '22-28 Luglio — EXAM LAB PHASE 🎯',
        days: [
          {
            date: '2026-07-22',
            label: 'Mer 22 Lug — EXAM DAY 1 (START)',
            hours: '12h+',
            tasks: [
              '08:00 — Wake up: doccia, colazione proteica, stretching 10min, NO scroll social',
              '09:00 — START: login portale HTB Academy + VPN connessione',
              'Apri lettera di engagement, leggi attentamente tutti gli obiettivi',
              'Time-track in spreadsheet: Time | Action | Result',
              'Ore 1-3 — Recon esterno: scan completo perimeter, identifica services, screenshot',
              'Ore 3-8 — Foothold: pick easiest entry, no tunnel-vision (2h senza progresso → switch)',
              'Ore 8-12 — Internal recon (post foothold): pivoting, internal scan, AD enum low-priv',
              'Stop entro le 22:00. Riposa 8h vere.',
            ],
          },
          {
            date: '2026-07-23',
            label: 'Gio 23 Lug — EXAM DAY 2 (Lateral + AD)',
            hours: '10h+',
            tasks: [
              'AD attacks systematic (Kerberoasting, AS-REP, ACL abuse)',
              'Privesc local',
              'Lateral movement chains',
              'BloodHound graph aggiornato',
              'Documenta ogni step con screenshot',
            ],
          },
          {
            date: '2026-07-24',
            label: 'Ven 24 Lug — EXAM DAY 3 (Lateral continuation)',
            hours: '10h+',
            tasks: [
              'Continua AD attacks chain',
              'Privesc box-by-box',
              'Lateral movement consolidato',
              'Aggiorna BloodHound graph',
              'Screenshot per ogni flag intercettato',
            ],
          },
          {
            date: '2026-07-25',
            label: 'Sab 25 Lug — EXAM DAY 4 (AD attacks deep)',
            hours: '10h+',
            tasks: [
              'AD attacks advanced (delegation, ADCS, trust)',
              'Pivoting multi-hop',
              'Identifica path verso DA',
              'Crisis check: se bloccato 3h+ → switch obiettivo o chiedi hint AI',
            ],
          },
          {
            date: '2026-07-26',
            label: 'Dom 26 Lug — EXAM DAY 5 (Domain compromise push)',
            hours: '10h+',
            tasks: [
              'NON è giorno di rest — esame in corso',
              'Push verso DA',
              'Hit i flag finali',
              'Persistence se richiesto (verifica scope)',
            ],
          },
          {
            date: '2026-07-27',
            label: 'Lun 27 Lug — EXAM DAY 6 (Final push + cleanup)',
            hours: '10h+',
            tasks: [
              'Final push sui target rimanenti',
              'Cleanup actions se richiesto',
              'Verifica screenshot per OGNI flag e major finding',
              'Inizia organizzazione findings spreadsheet',
            ],
          },
          {
            date: '2026-07-28',
            label: 'Mar 28 Lug — EXAM DAY 7 (Cleanup + screenshot review)',
            hours: '8h',
            tasks: [
              'Verifica screenshot per OGNI flag',
              'Cleanup actions',
              'Submit findings spreadsheet',
              'Lab phase TERMINA — passaggio a report phase',
            ],
          },
        ],
      },
      {
        id: 'w13',
        label: 'Settimana 13',
        range: '29 Luglio - 4 Agosto — REPORT PHASE 📝',
        days: [
          {
            date: '2026-07-29',
            label: 'Mer 29 Lug — Report Day 1: outline + executive summary',
            hours: '8h',
            tasks: [
              '⚠️ 50% del voto è il report. Non sottostimarlo.',
              'Outline completo del report',
              'Executive Summary (1 pagina, business-language)',
              'Methodology section',
              'Scope & Rules of Engagement',
            ],
          },
          {
            date: '2026-07-30',
            label: 'Gio 30 Lug — Report Day 2: detailed findings parte 1',
            hours: '8h',
            tasks: [
              'Detailed findings: vulns critical/high',
              'Per ogni finding: descrizione, impact, evidence (screenshot), reproduction steps',
              'Severity ratings con CVSS',
            ],
          },
          {
            date: '2026-07-31',
            label: 'Ven 31 Lug — Report Day 3: detailed findings parte 2',
            hours: '8h',
            tasks: [
              '🎯 Target esame "31 Luglio" significa fine LAB phase il 31 — qui sei in report writing',
              'Detailed findings: vulns medium/low',
              'Documentation chain completa',
            ],
          },
          {
            date: '2026-08-01',
            label: 'Sab 1 Ago — Report Day 4: attack path diagram',
            hours: '8h',
            tasks: [
              'Attack Path Diagram (visuale chiaro)',
              'Crea timeline degli attacchi',
              'Cross-reference findings con timeline',
            ],
          },
          {
            date: '2026-08-02',
            label: 'Dom 2 Ago — Report Day 5: recommendations',
            hours: '8h',
            tasks: [
              'NON rest — report in corso',
              'Mitigation & Recommendations per ogni finding',
              'Prioritization roadmap (short/medium/long term)',
              'Appendix con tool output',
            ],
          },
          {
            date: '2026-08-03',
            label: 'Lun 3 Ago — Report Day 6: review + polish',
            hours: '8h',
            tasks: [
              'Review completo del report',
              'Fix typos, formatting, broken images',
              'Spell check + grammar',
              'Peer-review opzionale (Claude)',
            ],
          },
          {
            date: '2026-08-04',
            label: 'Mar 4 Ago — Report Day 7: final check + PDF + SUBMIT 🚀',
            hours: '6h',
            tasks: [
              'Final check: indice corretto, header/footer, pagination',
              'Export PDF clean',
              'Verifica submission ricevuta sul portale HTB Academy',
              '🎉 GIORNATA LIBERA dopo submit — meritata',
              'Buffer post-esame: ~7 settimane prima UOC (23 Set), recovery + risultato (~2-3 settimane)',
            ],
          },
        ],
      },
    ],
  },
];

"""Study plan models.

Two complementary stores live here:

* ``StudyTaskState`` — legacy per-task check/skip/move metadata for the old
  day-based frontend roadmap (``studyPlanData.ts``). Kept for backward compat.
* ``StudyPlan`` + ``StudyModule`` — the server-persisted CPTS curriculum used by
  the Studio page. A plan is a per-user singleton carrying the start date and the
  current week (1..13); its modules are the canonical HTB CPTS module sequence,
  each with a completion flag and an optional Obsidian link. Progress always
  starts at zero — no fabricated completion or hours.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date

from app.core.database import Base

# ── Canonical HTB CPTS curriculum ─────────────────────────────────────────────
# The real HTB Academy CPTS job-role path: 28 modules, each with a short topic
# brief, the HTB Academy module URL, and the ordered list of section titles
# (subchapters). This is the public curriculum STRUCTURE — pre-seeded so the
# Studio page is navigable out of the box and fully user-editable from the UI.
# NO fabricated progress: completion always starts at zero. Module ids, titles
# and section lists are verified against HTB path 16 (Penetration Tester) via
# GET /api/v2/paths/16/modules + /api/v3/modules/<id>/sections.
CPTS_CURRICULUM: list[dict] = [
    {
        "title": "Penetration Testing Process",
        "htb_id": 90,
        "brief": "Le fasi di un penetration test end-to-end: pre-engagement, recon, exploitation, post-ex, reporting.",
        "sections": [
            "Introduction to the Penetration Tester Path", "Academy Modules Layout",
            "Academy Exercises & Questions", "Penetration Testing Overview",
            "Laws and Regulations", "Penetration Testing Process", "Pre-Engagement",
            "Information Gathering", "Vulnerability Assessment", "Exploitation",
            "Post-Exploitation", "Lateral Movement", "Proof-of-Concept", "Post-Engagement",
            "Practice",
        ],
    },
    {
        "title": "Getting Started",
        "htb_id": 77,
        "brief": "Fondamenti del pentest e primo box guidato: distro, VPN, tool base, scanning, shell, privesc e workflow HTB (modulo Nibbles).",
        "sections": [
            "Infosec Overview", "Getting Started with a Pentest Distro", "Staying Organized",
            "Connecting Using VPN", "Common Terms", "Basic Tools", "Service Scanning",
            "Web Enumeration", "Public Exploits", "Types of Shells", "Privilege Escalation",
            "Transferring Files", "Starting Out", "Navigating HTB", "Nibbles - Enumeration",
            "Nibbles - Web Footprinting", "Nibbles - Initial Foothold",
            "Nibbles - Privilege Escalation", "Nibbles - Alternate User Method - Metasploit",
            "Common Pitfalls", "Getting Help", "Next Steps", "Knowledge Check",
        ],
    },
    {
        "title": "Network Enumeration with Nmap",
        "htb_id": 19,
        "brief": "Scansione di rete con Nmap: host/port discovery, service e version detection, NSE, evasione firewall/IDS.",
        "sections": [
            "Enumeration", "Introduction to Nmap", "Host Discovery", "Host and Port Scanning",
            "Saving the Results", "Service Enumeration", "Nmap Scripting Engine",
            "Performance", "Firewall and IDS/IPS Evasion",
            "Firewall and IDS/IPS Evasion - Easy Lab",
            "Firewall and IDS/IPS Evasion - Medium Lab",
            "Firewall and IDS/IPS Evasion - Hard Lab",
        ],
    },
    {
        "title": "Footprinting",
        "htb_id": 112,
        "brief": "Enumerazione di servizi e protocolli (FTP/SMB/NFS/DNS/SMTP/SNMP/DB…) per mappare la superficie d'attacco.",
        "sections": [
            "Enumeration Principles", "Enumeration Methodology", "Domain Information",
            "Cloud Resources", "Staff", "FTP", "SMB", "NFS", "DNS", "SMTP", "IMAP / POP3",
            "SNMP", "MySQL", "MSSQL", "Oracle TNS", "IPMI",
            "Linux Remote Management Protocols", "Windows Remote Management Protocols",
            "Footprinting Lab - Easy", "Footprinting Lab - Medium", "Footprinting Lab - Hard",
        ],
    },
    {
        "title": "Information Gathering - Web Edition",
        "htb_id": 144,
        "brief": "Recon web passivo e attivo: WHOIS, DNS, subdomain, virtual host, fingerprinting, crawling, automazione.",
        "sections": [
            "Introduction", "WHOIS", "Utilizing WHOIS", "DNS", "Digging DNS", "Subdomains",
            "Subdomain Bruteforcing", "DNS Zone Transfers", "Virtual Hosts",
            "Certificate Transparency Logs", "Fingerprinting", "Crawling", "robots.txt",
            ".Well-Known URIs", "Creepy Crawlies", "Search Engine Discovery", "Web Archives",
            "Automating Recon", "Skills Assessment",
        ],
    },
    {
        "title": "Vulnerability Assessment",
        "htb_id": 108,
        "brief": "Il processo di vulnerability assessment, scoring CVSS/CVE e uso pratico di Nessus e OpenVAS.",
        "sections": [
            "Security Assessments", "Vulnerability Assessment", "Assessment Standards",
            "Common Vulnerability Scoring System (CVSS)",
            "Common Vulnerabilities and Exposures (CVE)", "Vulnerability Scanning Overview",
            "Getting Started with Nessus", "Nessus Scan", "Advanced Settings",
            "Working with Nessus Scan Output", "Scanning Issues", "Nessus Skills Assessment",
            "Getting Started with OpenVAS", "OpenVAS Scan", "Exporting The Results",
            "OpenVAS Skills Assessment", "Reporting",
        ],
    },
    {
        "title": "File Transfers",
        "htb_id": 24,
        "brief": "Trasferire file su Windows/Linux con metodi living-off-the-land, code-based, protezione ed evasione.",
        "sections": [
            "File Transfers", "Windows File Transfer Methods", "Linux File Transfer Methods",
            "Transferring Files with Code", "Miscellaneous File Transfer Methods",
            "Protected File Transfers", "Catching Files over HTTP/S", "Living off The Land",
            "Detection", "Evading Detection",
        ],
    },
    {
        "title": "Shells & Payloads",
        "htb_id": 115,
        "brief": "Anatomia delle shell, bind/reverse, generazione payload (msfvenom), web shell su Windows e Linux.",
        "sections": [
            "Shells Jack Us In, Payloads Deliver Us Shells",
            "CAT5 Security's Engagement Preparation", "Anatomy of a Shell", "Bind Shells",
            "Reverse Shells", "Introduction to Payloads",
            "Automating Payloads & Delivery with Metasploit",
            "Crafting payloads with MSFvenom", "Infiltrating Windows",
            "Infiltrating Unix/Linux", "Spawning Interactive Shells",
            "Introduction to Web Shells", "Laudanum, One Webshell to Rule Them All",
            "Antak Webshell", "PHP Web Shells", "The Live Engagement",
            "Detection & Prevention",
        ],
    },
    {
        "title": "Using the Metasploit Framework",
        "htb_id": 39,
        "brief": "Metasploit: msfconsole, moduli, payload, encoder, sessioni, Meterpreter, plugin ed evasione.",
        "sections": [
            "Preface", "Introduction to Metasploit", "Introduction to MSFconsole", "Modules",
            "Targets", "Payloads", "Encoders", "Databases", "Plugins & Mixins",
            "Sessions & Jobs", "Meterpreter", "Writing & Importing Modules",
            "Introduction to MSFVenom", "Firewall and IDS/IPS evasion",
            "Metasploit-Framework Updates - August 2020",
        ],
    },
    {
        "title": "Password Attacks",
        "htb_id": 147,
        "brief": "Attacchi a credenziali: cracking, dumping di hash Windows/Linux, attacchi a servizi, pass-the-hash/ticket.",
        "sections": [
            "Introduction", "Introduction to Password Cracking",
            "Introduction to John The Ripper", "Introduction to Hashcat",
            "Writing Custom Wordlists and Rules", "Cracking Protected Files",
            "Cracking Protected Archives", "Network Services",
            "Spraying, Stuffing, and Defaults", "Windows Authentication Process",
            "Attacking SAM, SYSTEM, and SECURITY", "Attacking LSASS",
            "Attacking Windows Credential Manager", "Attacking Active Directory and NTDS.dit",
            "Credential Hunting in Windows", "Linux Authentication Process",
            "Credential Hunting in Linux", "Credential Hunting in Network Traffic",
            "Credential Hunting in Network Shares", "Pass the Hash (PtH)",
            "Pass the Ticket (PtT) from Windows", "Pass the Ticket (PtT) from Linux",
            "Pass the Certificate", "Password Policies", "Password Managers",
            "Skills Assessment - Password Attacks",
        ],
    },
    {
        "title": "Attacking Common Services",
        "htb_id": 116,
        "brief": "Exploitation dei servizi comuni: FTP, SMB, database SQL, RDP, DNS e servizi email.",
        "sections": [
            "Interacting with Common Services", "The Concept of Attacks",
            "Service Misconfigurations", "Finding Sensitive Information", "Attacking FTP",
            "Latest FTP Vulnerabilities", "Attacking SMB", "Latest SMB Vulnerabilities",
            "Attacking SQL Databases", "Latest SQL Vulnerabilities", "Attacking RDP",
            "Latest RDP Vulnerabilities", "Attacking DNS", "Latest DNS Vulnerabilities",
            "Attacking Email Services", "Latest Email Service Vulnerabilities",
            "Attacking Common Services - Easy", "Attacking Common Services - Medium",
            "Attacking Common Services - Hard",
        ],
    },
    {
        "title": "Pivoting, Tunneling, and Port Forwarding",
        "htb_id": 158,
        "brief": "Muoversi tra reti segmentate: port forwarding, SOCKS, tunneling (chisel, ligolo, sshuttle, dnscat2).",
        "sections": [
            "Introduction to Pivoting, Tunneling, and Port Forwarding",
            "The Networking Behind Pivoting",
            "Dynamic Port Forwarding with SSH and SOCKS Tunneling",
            "Remote/Reverse Port Forwarding with SSH",
            "Meterpreter Tunneling & Port Forwarding",
            "Socat Redirection with a Reverse Shell", "Socat Redirection with a Bind Shell",
            "SSH for Windows: plink.exe", "SSH Pivoting with sshuttle",
            "Web Server Pivoting with Rpivot", "Port Forwarding with Windows: Netsh",
            "DNS Tunneling with Dnscat2", "SOCKS5 Tunneling with Chisel",
            "ICMP Tunneling with SOCKS", "RDP and SOCKS Tunneling with SocksOverRDP",
            "Skills Assessment", "Detection & Prevention", "Beyond this Module",
        ],
    },
    {
        "title": "Active Directory Enumeration & Attacks",
        "htb_id": 143,
        "brief": "Enumerazione e attacchi AD: poisoning, spraying, Kerberoasting, ACL, DCSync, trust, lateral movement.",
        "sections": [
            "Introduction to Active Directory Enumeration & Attacks", "Tools Of The Trade",
            "Scenario", "External Recon and Enumeration Principles",
            "Initial Enumeration of the Domain", "LLMNR/NBT-NS Poisoning - from Linux",
            "LLMNR/NBT-NS Poisoning - from Windows", "Password Spraying Overview",
            "Enumerating & Retrieving Password Policies",
            "Password Spraying - Making a Target User List",
            "Internal Password Spraying - from Linux",
            "Internal Password Spraying - from Windows", "Enumerating Security Controls",
            "Credentialed Enumeration - from Linux", "Credentialed Enumeration - from Windows",
            "Living Off the Land", "Kerberoasting - from Linux",
            "Kerberoasting - from Windows", "Access Control List (ACL) Abuse Primer",
            "ACL Enumeration", "ACL Abuse Tactics", "DCSync", "Privileged Access",
            "Kerberos \"Double Hop\" Problem", "Bleeding Edge Vulnerabilities",
            "Miscellaneous Misconfigurations", "Domain Trusts Primer",
            "Attacking Domain Trusts - Child -> Parent Trusts - from Windows",
            "Attacking Domain Trusts - Child -> Parent Trusts - from Linux",
            "Attacking Domain Trusts - Cross-Forest Trust Abuse - from Windows",
            "Attacking Domain Trusts - Cross-Forest Trust Abuse - from Linux",
            "Hardening Active Directory", "Additional AD Auditing Techniques",
            "AD Enumeration & Attacks - Skills Assessment Part I",
            "AD Enumeration & Attacks - Skills Assessment Part II", "Beyond this Module",
        ],
    },
    {
        "title": "Using Web Proxies",
        "htb_id": 110,
        "brief": "Burp Suite e OWASP ZAP: intercept, repeater, intruder/fuzzer, encoder, scanning ed estensioni.",
        "sections": [
            "Intro to Web Proxies", "Setting Up", "Proxy Setup", "Intercepting Web Requests",
            "Intercepting Responses", "Automatic Modification", "Repeating Requests",
            "Encoding/Decoding", "Proxying Tools", "Burp Intruder", "ZAP Fuzzer",
            "Burp Scanner", "ZAP Scanner", "Extensions",
            "Skills Assessment - Using Web Proxies",
        ],
    },
    {
        "title": "Attacking Web Applications with Ffuf",
        "htb_id": 54,
        "brief": "Fuzzing web con ffuf: directory, pagine, ricorsione, sub-domain/vhost, parametri e value fuzzing.",
        "sections": [
            "Introduction", "Web Fuzzing", "Directory Fuzzing", "Page Fuzzing",
            "Recursive Fuzzing", "DNS Records", "Sub-domain Fuzzing", "Vhost Fuzzing",
            "Filtering Results", "Parameter Fuzzing - GET", "Parameter Fuzzing - POST",
            "Value Fuzzing", "Skills Assessment - Web Fuzzing",
        ],
    },
    {
        "title": "Login Brute Forcing",
        "htb_id": 57,
        "brief": "Brute forcing di login e servizi con Hydra/Medusa, wordlist personalizzate e default credentials.",
        "sections": [
            "Introduction", "Password Security Fundamentals", "Brute Force Attacks",
            "Dictionary Attacks", "Hybrid Attacks", "Hydra", "Basic HTTP Authentication",
            "Login Forms", "Medusa", "Web Services", "Custom Wordlists",
            "Skills Assessment Part 1", "Skills Assessment Part 2",
        ],
    },
    {
        "title": "SQL Injection Fundamentals",
        "htb_id": 33,
        "brief": "Fondamenti SQLi: UNION, error/boolean-based, lettura/scrittura file, bypass auth e mitigazione.",
        "sections": [
            "Introduction", "Intro to Databases", "Types of Databases", "Intro to MySQL",
            "SQL Statements", "Query Results", "SQL Operators", "Intro to SQL Injections",
            "Subverting Query Logic", "Using Comments", "Union Clause", "Union Injection",
            "Database Enumeration", "Reading Files", "Writing Files",
            "Mitigating SQL Injection", "Skills Assessment - SQL Injection Fundamentals",
        ],
    },
    {
        "title": "SQLMap Essentials",
        "htb_id": 58,
        "brief": "Automazione SQLi con sqlmap: detection, enumerazione, bypass WAF, attack tuning, OS exploitation.",
        "sections": [
            "SQLMap Overview", "Getting Started with SQLMap", "SQLMap Output Description",
            "Running SQLMap on an HTTP Request", "Handling SQLMap Errors", "Attack Tuning",
            "Database Enumeration", "Advanced Database Enumeration",
            "Bypassing Web Application Protections", "OS Exploitation", "Skills Assessment",
        ],
    },
    {
        "title": "Cross-Site Scripting (XSS)",
        "htb_id": 103,
        "brief": "XSS stored/reflected/DOM: discovery, defacement, phishing, session hijacking e prevenzione.",
        "sections": [
            "Intro to XSS", "Stored XSS", "Reflected XSS", "DOM XSS", "XSS Discovery",
            "Defacing", "Phishing", "Session Hijacking", "XSS Prevention", "Skills Assessment",
        ],
    },
    {
        "title": "File Inclusion",
        "htb_id": 23,
        "brief": "LFI/RFI, wrapper e filtri PHP, log poisoning, RCE via upload e bypass dei filtri.",
        "sections": [
            "Intro to File Inclusions", "Local File Inclusion (LFI)", "Basic Bypasses",
            "PHP Filters", "PHP Wrappers", "Remote File Inclusion (RFI)",
            "LFI and File Uploads", "Log Poisoning", "Automated Scanning",
            "File Inclusion Prevention", "Skills Assessment - File Inclusion",
        ],
    },
    {
        "title": "File Upload Attacks",
        "htb_id": 136,
        "brief": "Bypass dei controlli di upload (client/blacklist/whitelist/type), web shell e RCE.",
        "sections": [
            "Intro to File Upload Attacks", "Absent Validation", "Upload Exploitation",
            "Client-Side Validation", "Blacklist Filters", "Whitelist Filters", "Type Filters",
            "Limited File Uploads", "Other Upload Attacks",
            "Preventing File Upload Vulnerabilities",
            "Skills Assessment - File Upload Attacks",
        ],
    },
    {
        "title": "Command Injections",
        "htb_id": 109,
        "brief": "OS command injection: operatori, identificazione e bypass dei filtri, obfuscation ed evasione.",
        "sections": [
            "Intro to Command Injections", "Detection", "Injecting Commands",
            "Other Injection Operators", "Identifying Filters", "Bypassing Space Filters",
            "Bypassing Other Blacklisted Characters", "Bypassing Blacklisted Commands",
            "Advanced Command Obfuscation", "Evasion Tools", "Command Injection Prevention",
            "Skills Assessment",
        ],
    },
    {
        "title": "Web Attacks",
        "htb_id": 134,
        "brief": "HTTP verb tampering, IDOR e XXE: identificazione, sfruttamento avanzato e prevenzione.",
        "sections": [
            "Introduction to Web Attacks", "Intro to HTTP Verb Tampering",
            "Bypassing Basic Authentication", "Bypassing Security Filters",
            "Verb Tampering Prevention", "Intro to IDOR", "Identifying IDORs",
            "Mass IDOR Enumeration", "Bypassing Encoded References", "IDOR in Insecure APIs",
            "Chaining IDOR Vulnerabilities", "IDOR Prevention", "Intro to XXE",
            "Local File Disclosure", "Advanced File Disclosure", "Blind Data Exfiltration",
            "XXE Prevention", "Web Attacks - Skills Assessment",
        ],
    },
    {
        "title": "Attacking Common Applications",
        "htb_id": 113,
        "brief": "Attacchi a CMS e app comuni: WordPress, Joomla, Drupal, Tomcat, Jenkins, Splunk, GitLab e altre.",
        "sections": [
            "Introduction to Attacking Common Applications",
            "Application Discovery & Enumeration", "WordPress - Discovery & Enumeration",
            "Attacking WordPress", "Joomla - Discovery & Enumeration", "Attacking Joomla",
            "Drupal - Discovery & Enumeration", "Attacking Drupal",
            "Tomcat - Discovery & Enumeration", "Attacking Tomcat",
            "Jenkins - Discovery & Enumeration", "Attacking Jenkins",
            "Splunk - Discovery & Enumeration", "Attacking Splunk", "PRTG Network Monitor",
            "osTicket", "Gitlab - Discovery & Enumeration", "Attacking GitLab",
            "Attacking Tomcat CGI", "Attacking CGI Applications - Shellshock",
            "Attacking Thick Client Applications",
            "Exploiting Web Vulnerabilities in Thick-Client Applications",
            "ColdFusion - Discovery & Enumeration", "Attacking ColdFusion",
            "IIS Tilde Enumeration", "Attacking LDAP", "Web Mass Assignment Vulnerabilities",
            "Attacking Applications Connecting to Services", "Other Notable Applications",
            "Application Hardening", "Attacking Common Applications - Skills Assessment I",
            "Attacking Common Applications - Skills Assessment II",
            "Attacking Common Applications - Skills Assessment III",
        ],
    },
    {
        "title": "Linux Privilege Escalation",
        "htb_id": 51,
        "brief": "PrivEsc Linux: enumerazione, SUID/SGID, sudo, capabilities, cron, container e kernel exploit.",
        "sections": [
            "Introduction to Linux Privilege Escalation", "Environment Enumeration",
            "Linux Services & Internals Enumeration", "Credential Hunting", "Path Abuse",
            "Wildcard Abuse", "Escaping Restricted Shells", "Special Permissions",
            "Sudo Rights Abuse", "Privileged Groups", "Capabilities", "Vulnerable Services",
            "Cron Job Abuse", "LXD", "Docker", "Kubernetes", "Logrotate",
            "Miscellaneous Techniques", "Kernel Exploits", "Shared Libraries",
            "Shared Object Hijacking", "Python Library Hijacking", "Sudo", "Polkit",
            "Dirty Pipe", "Netfilter", "Linux Hardening",
            "Linux Local Privilege Escalation - Skills Assessment",
        ],
    },
    {
        "title": "Windows Privilege Escalation",
        "htb_id": 67,
        "brief": "PrivEsc Windows: privilegi e token, abuso servizi, UAC/credential theft, kernel e misconfig.",
        "sections": [
            "Introduction to Windows Privilege Escalation", "Useful Tools",
            "Situational Awareness", "Initial Enumeration", "Communication with Processes",
            "Windows Privileges Overview", "SeImpersonate and SeAssignPrimaryToken",
            "SeDebugPrivilege", "SeTakeOwnershipPrivilege", "Windows Built-in Groups",
            "Event Log Readers", "DnsAdmins", "Hyper-V Administrators", "Print Operators",
            "Server Operators", "User Account Control", "Weak Permissions", "Kernel Exploits",
            "Vulnerable Services", "DLL Injection", "Credential Hunting", "Other Files",
            "Further Credential Theft", "Citrix Breakout", "Interacting with Users",
            "Pillaging", "Miscellaneous Techniques", "Legacy Operating Systems",
            "Windows Server", "Windows Desktop Versions", "Windows Hardening",
            "Windows Privilege Escalation Skills Assessment - Part I",
            "Windows Privilege Escalation Skills Assessment - Part II",
        ],
    },
    {
        "title": "Documentation & Reporting",
        "htb_id": 162,
        "brief": "Note-taking durante l'engagement, struttura e scrittura del report, consegna al cliente.",
        "sections": [
            "Introduction to Documentation & Reporting", "Notetaking & Organization",
            "Types of Reports", "Components of a Report", "How to Write Up a Finding",
            "Reporting Tips and Tricks", "Documentation & Reporting Practice Lab",
            "Beyond this Module - Documentation & Reporting",
        ],
    },
    {
        "title": "Attacking Enterprise Networks",
        "htb_id": 163,
        "brief": "Engagement completo end-to-end su rete enterprise: external → foothold → internal → AD → reporting.",
        "sections": [
            "Intro to Attacking Enterprise Networks", "Scenario & Kickoff",
            "External Information Gathering", "Service Enumeration & Exploitation",
            "Web Enumeration & Exploitation", "Initial Access",
            "Post-Exploitation Persistence", "Internal Information Gathering",
            "Exploitation & Privilege Escalation", "Lateral Movement",
            "Active Directory Compromise", "Post-Exploitation", "Engagement Closeout",
            "Beyond this Module",
        ],
    },
]

# HTB Academy module URL for a curriculum entry's id.
def htb_module_url(htb_id: int | None) -> str | None:
    return f"https://academy.hackthebox.com/module/details/{htb_id}" if htb_id else None


# Titles only — kept for backward compatibility with the legacy reset path.
CPTS_MODULES: list[str] = [m["title"] for m in CPTS_CURRICULUM]

# CPTS exam/study horizon used by the Studio page header (settimana x / N).
CPTS_TOTAL_WEEKS: int = 13


class StudyTaskState(Base):
    """Per-task user state for the CRTP study plan."""

    __tablename__ = "study_task_states"
    __table_args__ = (
        UniqueConstraint("user_id", "task_id", name="uq_study_task_user_task"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Deterministic id from frontend: "YYYY-MM-DD-{idx}"
    # The date prefix encodes the original day; moved_to_date overrides the render target.
    task_id = Column(String(64), nullable=False, index=True)

    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    skipped = Column(Boolean, default=False, nullable=False)

    # If non-null, render this task on this date instead of its original date.
    moved_to_date = Column(String(10), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyTaskState(task_id={self.task_id}, completed={self.completed}, skipped={self.skipped})>"


class StudyPlan(Base):
    """Per-user CPTS study plan (singleton). Carries timeline metadata only."""

    __tablename__ = "study_plans"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_study_plan_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Day the plan begins (week 1). Defaults to the CPTS kickoff date.
    start_date = Column(Date, nullable=False, default=date(2026, 6, 22))
    # 1-based current week within the 13-week horizon.
    current_week = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyPlan(user_id={self.user_id}, start_date={self.start_date}, week={self.current_week})>"


class StudyModule(Base):
    """A single CPTS module row inside a user's plan.

    Title comes from the canonical CPTS sequence; completion starts at False and
    obsidian_link is null until the user pastes one (the vault is off-device).
    """

    __tablename__ = "study_modules"
    __table_args__ = (
        UniqueConstraint("user_id", "order_index", name="uq_study_module_user_order"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    plan_id = Column(
        UUID(as_uuid=True), ForeignKey("study_plans.id"), nullable=False, index=True
    )

    order_index = Column(Integer, nullable=False, default=0)
    title = Column(String(160), nullable=False)
    # Short topic summary + HTB Academy module URL, seeded from the curriculum.
    brief = Column(String(512), nullable=True)
    htb_url = Column(String(1024), nullable=True)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    # obsidian:// URI or vault path; null until the user sets it. Never fabricated.
    obsidian_link = Column(String(1024), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyModule(order={self.order_index}, title={self.title!r}, completed={self.completed})>"


class StudyModuleSection(Base):
    """A single subchapter (HTB Academy section) inside a module.

    Title comes from the canonical curriculum; per-user completion starts False
    and obsidian_link is null until the user pastes the AI-summary note. The
    section opens on its parent module's HTB URL (HTB has no stable per-section
    deep link). Nothing fabricated.
    """

    __tablename__ = "study_module_sections"
    __table_args__ = (
        UniqueConstraint("module_id", "order_index", name="uq_study_section_module_order"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    module_id = Column(
        UUID(as_uuid=True), ForeignKey("study_modules.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    order_index = Column(Integer, nullable=False, default=0)
    title = Column(String(200), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    obsidian_link = Column(String(1024), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyModuleSection(order={self.order_index}, title={self.title!r}, completed={self.completed})>"

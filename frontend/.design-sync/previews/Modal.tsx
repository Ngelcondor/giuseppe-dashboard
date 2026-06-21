import { Modal, Button } from 'giuseppe-dashboard';

// Modal is position:fixed inset-0. The single-card wrapper (.ds-single) is
// transformed, so it becomes the fixed containing block — a full-height
// spacer gives it real height so the modal centers instead of clipping.
const fill: React.CSSProperties = { height: '100vh', background: 'rgb(8 8 10)' };

export const Default = () => (
  <>
    <div style={fill} />
    <Modal
      isOpen={true}
      onClose={() => {}}
      title="Nuova sessione di studio"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm">Annulla</Button>
          <Button variant="primary" size="sm">Crea sessione</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-body text-sm leading-relaxed">
          Pianifica un blocco di studio focalizzato. Imposta materia, durata e
          l'obiettivo per la sessione Pomodoro.
        </p>
        <div className="space-y-1">
          <p className="text-tertiary text-xs">Materia</p>
          <p className="text-heading text-sm font-medium">Crittografia applicata · Capitolo 4 (RSA)</p>
        </div>
        <div className="space-y-1">
          <p className="text-tertiary text-xs">Durata</p>
          <p className="text-heading text-sm font-medium">4 × 25 min · pausa 5 min</p>
        </div>
      </div>
    </Modal>
  </>
);

export const Large = () => (
  <>
    <div style={fill} />
    <Modal
      isOpen={true}
      onClose={() => {}}
      title="Dettagli challenge CTF"
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm">Chiudi</Button>
          <Button variant="success" size="sm">Segna come risolta</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-body text-sm leading-relaxed">
          <span className="text-heading font-medium">Active Directory · Forest</span> —
          macchina Hard su Hack The Box. Foothold tramite Kerberoasting, privesc via
          delega vincolata, infine DCSync per il flag di SYSTEM.
        </p>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded bg-card-inner text-tertiary">impacket</span>
          <span className="text-xs px-2 py-1 rounded bg-card-inner text-tertiary">BloodHound</span>
          <span className="text-xs px-2 py-1 rounded bg-card-inner text-tertiary">evil-winrm</span>
        </div>
        <p className="text-muted text-xs">Avviata 3 giorni fa · 2 flag su 2 catturati</p>
      </div>
    </Modal>
  </>
);

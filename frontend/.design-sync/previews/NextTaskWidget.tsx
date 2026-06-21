import { NextTaskWidget } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16, maxWidth: 440 };

export const Critica = () => (
  <div style={stage}>
    <NextTaskWidget
      task={{
        id: 'oscp-1',
        title: 'Consegna report PWK',
        description: 'Finalizzare il report del lab Active Directory e caricarlo sul portale OffSec.',
        priority: 'critical',
        dueDate: '2026-06-22',
      }}
    />
  </div>
);

export const Media = () => (
  <div style={stage}>
    <NextTaskWidget
      task={{
        id: 'htb-3',
        title: 'Risolvere box HTB "Cascade"',
        description: 'Enumerazione LDAP e recupero credenziali dal backup di Active Directory.',
        priority: 'medium',
        dueDate: '2026-06-25',
      }}
    />
  </div>
);

export const Completati = () => (
  <div style={stage}>
    <NextTaskWidget task={null} />
  </div>
);

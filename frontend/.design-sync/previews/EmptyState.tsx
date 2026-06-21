import { EmptyState, Button } from 'giuseppe-dashboard';
import { Inbox, Trophy } from 'lucide-react';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16, maxWidth: 420 };

export const Default = () => (
  <div style={stage}>
    <EmptyState
      icon={Inbox}
      title="Nessuna attività in programma"
      description="Non hai sessioni di studio pianificate per oggi. Aggiungi un blocco per iniziare a tracciare i tuoi Pomodoro."
    />
  </div>
);

export const WithAction = () => (
  <div style={stage}>
    <EmptyState
      icon={Trophy}
      title="Nessun CTF risolto questa settimana"
      description="Inizia una nuova challenge su Hack The Box per aggiornare la tua streak."
      action={<Button variant="primary" size="sm">Sfoglia challenge</Button>}
    />
  </div>
);

export const Compact = () => (
  <div style={stage}>
    <EmptyState
      icon={Inbox}
      title="Nessuna nota recente"
      description="Le note dal vault Obsidian appariranno qui."
      compact
    />
  </div>
);

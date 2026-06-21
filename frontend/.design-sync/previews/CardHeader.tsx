import { Card, CardHeader, CardBody, StatusBadge } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Titolo = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardHeader>
        <h3 className="text-heading text-base font-semibold">Sessione Pomodoro</h3>
        <p className="text-tertiary text-xs mt-1">Crittografia · Capitolo 4</p>
      </CardHeader>
      <CardBody>
        <p className="text-body text-sm leading-relaxed">
          Il CardHeader separa il titolo dal corpo con un bordo inferiore del
          design system.
        </p>
      </CardBody>
    </Card>
  </div>
);

export const ConAzione = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-heading text-base font-semibold">Lab HTB attivo</h3>
            <p className="text-tertiary text-xs mt-1">Active Directory · Forest</p>
          </div>
          <StatusBadge status="active" />
        </div>
      </CardHeader>
      <CardBody>
        <p className="text-body text-sm leading-relaxed">
          Header con titolo a sinistra e badge di stato allineato a destra.
        </p>
      </CardBody>
    </Card>
  </div>
);

import { Card, CardHeader, CardBody, CardFooter, Button } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Composed = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardHeader>
        <h3 className="text-heading text-base font-semibold">Sessione di studio</h3>
        <p className="text-tertiary text-xs mt-1">Crittografia · Capitolo 4</p>
      </CardHeader>
      <CardBody>
        <p className="text-body text-sm leading-relaxed">
          Rivedi gli appunti su RSA e completa gli esercizi del set 4 prima del
          Pomodoro delle 18:00.
        </p>
      </CardBody>
      <CardFooter>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm">Rimanda</Button>
          <Button variant="primary" size="sm">Inizia</Button>
        </div>
      </CardFooter>
    </Card>
  </div>
);

export const Plain = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardBody>
        <p className="text-heading text-sm font-medium">Obiettivo settimanale</p>
        <p className="text-tertiary text-xs mt-1.5 leading-relaxed">
          Card di solo corpo — nessun header o footer. Si appoggia sulla pagina
          con bordo e angoli arrotondati del design system.
        </p>
      </CardBody>
    </Card>
  </div>
);

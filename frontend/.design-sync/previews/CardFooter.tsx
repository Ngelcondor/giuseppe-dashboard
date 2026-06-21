import { Card, CardHeader, CardBody, CardFooter, Button } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const ConAzioni = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardHeader>
        <h3 className="text-heading text-base font-semibold">Sessione di studio</h3>
      </CardHeader>
      <CardBody>
        <p className="text-body text-sm leading-relaxed">
          Completa il set di esercizi su RSA prima del prossimo Pomodoro.
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

export const ConMeta = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardBody>
        <p className="text-heading text-sm font-medium">Writeup: Forest</p>
        <p className="text-tertiary text-xs mt-1.5 leading-relaxed">
          AS-REP roasting → DCSync → Domain Admin. Note salvate nel vault Obsidian.
        </p>
      </CardBody>
      <CardFooter>
        <div className="flex items-center justify-between">
          <span className="text-muted text-xs">Aggiornato 2 ore fa</span>
          <span className="text-tertiary text-xs font-mono-display">#htb-ad</span>
        </div>
      </CardFooter>
    </Card>
  </div>
);

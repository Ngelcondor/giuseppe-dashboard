import { Card, CardHeader, CardBody } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Testo = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardHeader>
        <h3 className="text-heading text-base font-semibold">Note di studio</h3>
      </CardHeader>
      <CardBody>
        <p className="text-body text-sm leading-relaxed">
          Il CardBody contiene il contenuto principale con padding uniforme.
          Rivedi gli appunti su Kerberos e prepara la sintesi per la sessione
          serale.
        </p>
      </CardBody>
    </Card>
  </div>
);

export const Metriche = () => (
  <div style={stage}>
    <Card style={{ maxWidth: 400 }}>
      <CardBody>
        <p className="text-tertiary text-xs uppercase tracking-wide mb-3">Riepilogo giornata</p>
        <div className="flex gap-6">
          <div>
            <p className="font-mono-display text-heading text-2xl leading-none">5</p>
            <p className="text-muted text-xs mt-1">Pomodori</p>
          </div>
          <div>
            <p className="font-mono-display text-heading text-2xl leading-none">7h 20m</p>
            <p className="text-muted text-xs mt-1">Sonno</p>
          </div>
          <div>
            <p className="font-mono-display text-heading text-2xl leading-none">3</p>
            <p className="text-muted text-xs mt-1">CTF</p>
          </div>
        </div>
      </CardBody>
    </Card>
  </div>
);

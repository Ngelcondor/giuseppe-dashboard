import { Surface } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={stage}>
    <Surface variant="default" style={{ maxWidth: 360 }}>
      <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">Streak studio</p>
      <p className="text-2xl font-semibold leading-none font-mono-display text-heading">
        14<span className="text-base text-tertiary font-normal ml-1">giorni</span>
      </p>
      <p className="text-tertiary text-xs mt-3 leading-relaxed">
        Sessioni consecutive sul percorso CPTS. Continua così fino all'esame.
      </p>
    </Surface>
  </div>
);

export const Accent = () => (
  <div style={stage}>
    <Surface variant="accent" style={{ maxWidth: 360 }}>
      <h3 className="text-heading text-base font-semibold">Prossimo Pomodoro</h3>
      <p className="text-tertiary text-xs mt-1.5 leading-relaxed">
        Active Directory · enumerazione Kerberos. Inizia il blocco da 25 minuti
        alle 18:00 e segna gli appunti nel vault.
      </p>
    </Surface>
  </div>
);

export const Flat = () => (
  <div style={stage}>
    <Surface variant="flat" style={{ maxWidth: 360 }}>
      <p className="text-heading text-sm font-medium">Budget di giugno</p>
      <p className="text-tertiary text-xs mt-1.5 leading-relaxed">
        Variante piatta — sfondo interno e bordo sottile, senza glow. 612 € spesi
        su 850 € pianificati.
      </p>
    </Surface>
  </div>
);

export const Trio = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 }}>
    <Surface variant="default" padding="sm">
      <p className="text-heading text-sm font-medium">Default · card-glass</p>
    </Surface>
    <Surface variant="accent" padding="sm">
      <p className="text-heading text-sm font-medium">Accent · card-accent</p>
    </Surface>
    <Surface variant="flat" padding="sm">
      <p className="text-heading text-sm font-medium">Flat · bordo + inner bg</p>
    </Surface>
  </div>
);

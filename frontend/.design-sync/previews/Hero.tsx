import { Hero, Badge, Button } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Editorial = () => (
  <div style={{ ...stage, maxWidth: 720 }}>
    <Hero
      title="Buongiorno, Giuseppe"
      subtitle="Tre sessioni di studio in programma oggi e una macchina CTF da chiudere prima di sera. Mantieni il ritmo."
    />
  </div>
);

export const WithMetaAndActions = () => (
  <div style={{ ...stage, maxWidth: 720 }}>
    <Hero
      meta={<span className="font-mono-display text-[11px] tracking-[0.18em] uppercase text-tertiary">Missione · CPTS</span>}
      title="Percorso CPTS"
      subtitle="Avanzamento moduli, laboratori completati e tempo stimato all'esame."
      actions={
        <>
          <Badge variant="success" size="sm">68% completo</Badge>
          <Button variant="primary" size="sm">Riprendi</Button>
        </>
      }
    />
  </div>
);

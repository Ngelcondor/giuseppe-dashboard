import { ConfirmModal } from 'giuseppe-dashboard';

// ConfirmModal builds on Modal (position:fixed). The single-card wrapper is a
// transformed containing block — a full-height spacer lets the dialog center.
const fill: React.CSSProperties = { height: '100vh', background: 'rgb(8 8 10)' };

export const Danger = () => (
  <>
    <div style={fill} />
    <ConfirmModal
      isOpen={true}
      title="Elimina abitudine"
      message="Vuoi davvero eliminare l'abitudine «Allenamento 5x a settimana»? Tutti i dati di streak e progresso verranno persi definitivamente."
      isDanger
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </>
);

export const Default = () => (
  <>
    <div style={fill} />
    <ConfirmModal
      isOpen={true}
      title="Termina Pomodoro"
      message="Stai per interrompere la sessione di focus in corso. Il tempo trascorso verrà comunque registrato nello storico."
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </>
);

export const Loading = () => (
  <>
    <div style={fill} />
    <ConfirmModal
      isOpen={true}
      title="Archivia challenge"
      message="L'archiviazione sposterà la challenge nello storico CTF e aggiornerà la tua streak settimanale."
      isLoading
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </>
);

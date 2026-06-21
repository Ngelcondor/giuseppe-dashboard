import { Stepper } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

const ctfSteps = [
  { id: 'recon', label: 'Recon', completed: true },
  { id: 'foothold', label: 'Foothold', completed: true },
  { id: 'privesc', label: 'Privesc', completed: false },
  { id: 'root', label: 'Root flag', completed: false },
];

export const Horizontal = () => (
  <div style={stage}>
    <Stepper steps={ctfSteps} currentStep={2} orientation="horizontal" />
  </div>
);

export const Vertical = () => (
  <div style={stage}>
    <Stepper steps={ctfSteps} currentStep={2} orientation="vertical" />
  </div>
);

export const AllCompleted = () => (
  <div style={stage}>
    <Stepper
      steps={[
        { id: 'profilo', label: 'Profilo', completed: true },
        { id: 'obiettivi', label: 'Obiettivi', completed: true },
        { id: 'fatto', label: 'Pronto', completed: true },
      ]}
      currentStep={3}
      orientation="horizontal"
    />
  </div>
);

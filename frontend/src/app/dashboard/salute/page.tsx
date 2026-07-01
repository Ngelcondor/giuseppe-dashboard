'use client';

import { WipPage } from '@/components/ui/WipPage';

export default function SalutePage() {
  return (
    <WipPage
      eyebrow="Benessere"
      title="Sa"
      titleAccent="lute"
      description="Dati Apple Health: attività, allenamenti, metriche corporee."
      planned={[
        'Passi, calorie e frequenza cardiaca da Apple Health',
        'Storico allenamenti con durata e distanze',
        'Trend settimanali e mensili',
      ]}
    />
  );
}

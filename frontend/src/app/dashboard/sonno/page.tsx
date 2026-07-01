'use client';

import { WipPage } from '@/components/ui/WipPage';

export default function SonnoPage() {
  return (
    <WipPage
      eyebrow="Benessere"
      title="So"
      titleAccent="nno"
      description="Sessioni e fasi del sonno sincronizzate da Sleep Cycle / Apple Watch."
      planned={[
        'Report del mattino: durata, qualità, fasi',
        'Storico notti con grafico delle fasi',
        'Correlazioni con umore e focus',
      ]}
    />
  );
}

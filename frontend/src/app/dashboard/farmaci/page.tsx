'use client';

import { WipPage } from '@/components/ui/WipPage';

export default function FarmaciPage() {
  return (
    <WipPage
      eyebrow="Benessere"
      title="Far"
      titleAccent="maci"
      description="Terapia, promemoria e aderenza — gestiti dal database, mai hardcoded."
      planned={[
        'Elenco farmaci con orari e dosaggi (CRUD)',
        'Registro assunzioni giornaliero',
        'Statistiche di aderenza mensile',
      ]}
    />
  );
}

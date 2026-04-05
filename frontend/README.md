# Giuseppe Dashboard - Frontend

Una progressive web app moderna, accessibile e inclusiva per la gestione personale di uno studente di cybersecurity con ADHD/ASD.

## Caratteristiche

- **Dark Mode per Default** con supporto light mode
- **Modalità a bassa stimolazione** (senza animazioni, colori morbidi)
- **Mobile-first** design responsive
- **Drag-and-drop** dashboard personalizzabile
- **PWA** - funziona offline e installabile come app
- **TypeScript** per type safety
- **Accessibile** (WCAG 2.1)

## Tech Stack

- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Zustand** per state management
- **TanStack Query** per API calls
- **react-grid-layout** per dashboard personalizzabile
- **next-pwa** per PWA support
- **Recharts** per visualizzazioni
- **Lucide React** per icone

## Setup

### Prerequisiti

- Node.js 18+
- npm o yarn

### Installazione

```bash
# Installa dipendenze
npm install

# Copia il file di configurazione environment
cp .env.example .env.local

# Modifica .env.local con i tuoi valori
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Development

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

### Build per Production

```bash
npm run build
npm start
```

## Struttura del Progetto

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Pagina di autenticazione
│   ├── dashboard/         # Dashboard principale
│   ├── settings/          # Impostazioni utente
│   ├── notifications/     # Notifiche
│   └── layout.tsx         # Root layout
├── components/
│   ├── layout/           # Componenti di layout (Header, Sidebar)
│   ├── ui/              # Componenti UI riutilizzabili
│   └── widgets/         # Widget specifici per dashboard
├── stores/              # Zustand stores (auth, theme, dashboard)
├── hooks/              # Custom React hooks
├── lib/               # Utility functions e configurazioni
│   ├── api.ts         # Axios instance con interceptors
│   ├── utils.ts       # Helper functions
│   └── constants.ts   # Costanti dell'app
├── types/             # TypeScript interfaces
└── public/            # File statici e PWA
```

## Componenti Principali

### Layout
- **Header**: Barra superiore con greeting, notifiche e tema
- **Sidebar**: Navigazione collassabile con icone color-coded
- **WidgetWrapper**: Wrapper riutilizzabile per widget

### UI
- **Button**: Con varianti (primary, secondary, ghost, danger)
- **Card**: Componente card con header/body/footer
- **Input**: Input con validazione e helper text
- **Modal**: Modal dialog accessibile
- **Badge**: Pill badge per stati
- **ProgressBar**: Progress bar animated
- **LoadingSpinner**: Spinner e skeleton loaders
- **Toggle/Checkbox**: Input per sì/no

### Widget
- **NextTaskWidget**: Mostra il prossimo compito da fare
- **QuickActions**: Grid di azioni rapide
- **WeatherWidget**: Meteo e previsioni
- **HealthOverview**: Metriche di salute
- E molti altri...

## State Management

### useAuthStore (Zustand)
```typescript
{
  user: User | null
  token: string | null
  isAuthenticated: boolean
  twoFARequired: boolean
  setUser()
  setToken()
  logout()
}
```

### useThemeStore (Zustand)
```typescript
{
  theme: 'dark' | 'light' | 'system'
  lowStim: boolean
  setTheme()
  setLowStim()
  toggleLowStim()
}
```

### useDashboardStore (Zustand)
```typescript
{
  layouts: { lg: WidgetLayout[], md: [], sm: [] }
  widgetPreferences: Record<string, WidgetPreferences>
  setLayout()
  toggleWidgetVisibility()
  resetLayout()
}
```

## Custom Hooks

- **useAuth()** - Autenticazione (login, register, logout)
- **useApi()** - Wrapper per GET/POST/PUT/DELETE requests
- **useTheme()** - Gestione tema
- **useMediaQuery()** - Responsive design utilities
- **useIsMobile()**, **useIsTablet()**, **useIsDesktop()** - Breakpoint helpers

## Styling

Tailwind CSS con configurazione custom:

```typescript
// Colori per tema scuro (default)
primary: #3B82F6
secondary: #10B981
danger: #EF4444

// Low-stim colors
primary: #8E7C6F (muted brown)
secondary: #A89A8F (muted gray)

// CSS custom properties per theming dinamico
--bg-primary, --bg-secondary, --bg-tertiary
--text-primary, --text-secondary, --text-tertiary
--border-color, --accent-color
```

Supporto per:
- `prefers-reduced-motion` - Disabilita animazioni per utenti che le preferiscono
- `prefers-color-scheme` - Segue preferenze di sistema

## Accessibilità

- Semantic HTML
- ARIA labels dove necessario
- Keyboard navigation support
- Focus styles ben visibili
- Contrast ratio WCAG AA compliant
- Screen reader friendly

## PWA Features

- Offline support
- Installabile su mobile
- App icons per tutti gli screen size
- Shortcuts (Dashboard, Create Task, Pomodoro)
- Push notifications ready

## API Integration

Axios instance in `src/lib/api.ts` con:
- Token authentication
- Automatic token refresh
- Error handling
- Request/response interceptors

```typescript
// Esempio di uso
const { useGet, usePost } = useApi();

// GET
const { data, isLoading } = useGet('/health/metrics');

// POST
const { mutate, isPending } = usePost('/deadlines', {
  onSuccess: (data) => console.log('Success', data)
});

mutate({ title: 'New deadline', dueDate: '2024-03-30' });
```

## Localizzazione

Tutto il testo è in italiano. Date e numeri usano locale `it-IT` tramite `date-fns` e `Intl` APIs.

## Best Practices

- Type everything with TypeScript
- Use Tailwind classes instead of inline styles
- Prefer composition over complex prop drilling
- Memoize expensive calculations with `useMemo`
- Use `useCallback` per event handlers in lists
- Sempre considerare low-stim mode quando si aggiungono animazioni
- Test responsive design su mobile devices

## Aggiungere Nuove Pagine

```typescript
// 1. Crea file in src/app/[nome]/page.tsx
'use client';

import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default function PageName() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Header onMenuToggle={() => setMenuOpen(!menuOpen)} isMenuOpen={menuOpen} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 overflow-y-auto">
          {/* Content */}
        </main>
      </div>
    </div>
  );
}
```

## Performance

- Image optimization with Next.js
- Code splitting automatic
- Dynamic imports per widget pesanti
- Zustand per state management minimale
- React Query caching intelligente
- CSS classes instead of inline styles

## Troubleshooting

### Tema non si applica
- Clearare cache del browser
- Verificare che Zustand store sia inizializzato
- Controllare `data-theme` attribute su `<html>`

### Widget grid non funziona
- Verificare che react-grid-layout CSS sia importato
- Controllare che `currentBreakpoint` sia set correttamente
- Verifi che il layout abbia elementi visibili

### API calls falliscono
- Controllare API_BASE_URL in .env.local
- Verifi token in localStorage
- Guardare network tab in DevTools

## Contribuire

1. Crea un branch (`git checkout -b feature/AmazingFeature`)
2. Commit cambiamenti (`git commit -m 'Add AmazingFeature'`)
3. Push al branch (`git push origin feature/AmazingFeature`)
4. Apri una Pull Request

## License

MIT

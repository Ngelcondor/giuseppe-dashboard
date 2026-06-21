# Giuseppe Dashboard — design system conventions

A **dark-first**, editorial personal-dashboard system. Build screens by composing the
real components below; reach for the semantic utility classes only for layout glue.

## Setup & theming

- **No provider is required.** The theme lives in CSS variables on `:root` and the dark
  palette is the default — components render correctly as soon as `styles.css` is loaded.
- **Render on the page background.** Components are designed to sit on the dark page, not on
  white. Wrap a screen's content in something with `bg-page` (or use `AppShell` /
  `EditorialPage` / `PageShell`, which paint it for you). On a white background the muted
  text (`text-tertiary`, `text-muted`) is unreadable.
- **Alternate themes** are opt-in via a `data-theme` attribute on a root element:
  `data-theme="light"`, `data-theme="low-stim"` (an ADHD/ASD-friendly calm palette), and
  `data-theme="low-stim"` combined with `.dark`. Default (no attribute) = dark.
- **Fonts** ship via `styles.css` (Google Fonts): Inter Tight (UI/display), Fraunces (serif
  italic accents), JetBrains Mono (numeric/mono).

## Styling idiom — utility classes with a semantic layer

Tailwind utilities PLUS a brand semantic layer. **Always prefer the semantic classes over
raw color/spacing values** — they carry the tokens and adapt across themes:

| Purpose | Classes |
|---|---|
| Surfaces | `bg-page` `bg-card` `bg-card-solid` `bg-card-inner` `bg-input` `bg-surface-hover` |
| Accent fills | `bg-accent` `bg-accent-soft` |
| Text | `text-heading` `text-body` `text-tertiary` `text-muted` |
| Accent text | `text-accent` (indigo) `text-accent-pink` `text-accent-sun` (yellow) `text-name` |
| Borders | `border-border-default` `border-border-hover` `border-accent` `border-accent-soft` |
| Type | `font-display` (Inter Tight) `font-serif` (Fraunces) `font-mono-display` (JetBrains Mono) `text-display` (huge editorial weight) `tracking-uppercase` |
| Primitives | `.panel` (editorial card) `.chip` / `.chip-accent` (pills) `.eyebrow` (uppercase label) `.dock` (floating nav) `.scrollbar-hidden` |

Components themselves are styled **via props**, not class overrides — e.g. `Button` takes
`variant` (`primary` `secondary` `ghost` `danger` `success`) and `size` (`sm` `md` `lg`);
`Badge` and `Surface` carry their own `variant` props likewise. Pass `className` only to add layout glue.

## Where the truth lives

- **`styles.css`** (and its `@import` of `_ds_bundle.css`) is the full stylesheet — read it
  for the exact token values and the complete class list before inventing styles.
- **Per component**: read `<Name>.d.ts` for the prop contract and `<Name>.prompt.md` for usage.
  All components are on `window.GiuseppeDS.*`.

## Build snippet

```tsx
// A dashboard sub-page: AppShell paints the dark page + nav; compose cards inside.
<AppShell title="Salute" subtitle="OGGI">
  <Surface variant="default" padding="md">
    <SectionHeader label="Sonno" hint="ultima notte" />
    <div className="flex gap-6 mt-2">
      <StatBlock label="Ore" value="7.2" unit="h" />
      <StatBlock label="Qualità" value="86" unit="%" />
    </div>
  </Surface>

  <Card className="mt-4">
    <CardHeader><h3 className="text-heading font-semibold">Prossima sessione</h3></CardHeader>
    <CardBody><p className="text-body text-sm">Crittografia · Capitolo 4</p></CardBody>
    <CardFooter>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm">Rimanda</Button>
        <Button variant="primary" size="sm">Inizia</Button>
      </div>
    </CardFooter>
  </Card>
</AppShell>
```

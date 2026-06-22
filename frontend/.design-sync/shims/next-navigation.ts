// Sync-time shim for next/navigation — static stubs so DS components that read
// routing state render outside the Next.js runtime. Wired via tsconfig.sync.json.
const noop = () => {};

export function usePathname(): string {
  return '/';
}

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    back: noop,
    forward: noop,
    refresh: noop,
    prefetch: noop,
  };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams<T = Record<string, string>>(): T {
  return {} as T;
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function useSelectedLayoutSegments(): string[] {
  return [];
}

export function redirect(_url?: string): void {}
export function permanentRedirect(_url?: string): void {}
export function notFound(): void {}

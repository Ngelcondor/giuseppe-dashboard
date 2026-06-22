// Sync-time shim for next/link — renders a plain <a> so DS components that
// use Link render outside the Next.js runtime. Wired via tsconfig.sync.json paths.
import React from 'react';

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  locale?: string | false;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll, shallow, passHref, locale, children, ...rest },
  ref,
) {
  const hrefStr = typeof href === 'string' ? href : href?.pathname ?? '#';
  return (
    <a ref={ref} href={hrefStr} {...rest}>
      {children}
    </a>
  );
});

export default Link;

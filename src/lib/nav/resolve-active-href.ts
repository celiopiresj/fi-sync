// Picks the single longest-`href`-prefix match across every candidate
// rather than letting each one check `pathname.startsWith(href)`
// independently — keeps this correct if a route's href ever nests under
// another one's (e.g. two routes sharing a prefix), so a deeper route
// doesn't highlight both entries at once. Shared by AppSidebar and
// MobileTabBar so the "which nav item is active" rule can't drift between
// the two.
export function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  return hrefs.reduce<string | null>((best, href) => {
    const matches = href === "/" ? pathname === "/" : pathname.startsWith(href);
    if (!matches) return best;
    if (!best || href.length > best.length) return href;
    return best;
  }, null);
}

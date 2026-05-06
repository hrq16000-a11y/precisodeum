/**
 * Returns true when a sidebar/nav item should be highlighted as active
 * for the current pathname. Handles trailing slashes and subroutes.
 *
 * Rules:
 * - Exact match (after trimming trailing slash) -> active.
 * - Subroute match (`pathname` starts with `itemPath + "/"`) -> active,
 *   except for the catch-all `/dashboard` which would otherwise match every
 *   nested dashboard route.
 */
export function isDashboardNavItemActive(pathname: string, itemPath: string): boolean {
  if (!pathname || !itemPath) return false;
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const target = itemPath.replace(/\/+$/, '') || '/';
  if (normalized === target) return true;
  if (target === '/dashboard') return false;
  return normalized.startsWith(target + '/');
}

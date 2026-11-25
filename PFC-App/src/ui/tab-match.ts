/** A tab is active on its root path and any child path ("/finance", "/finance/add"). */
export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

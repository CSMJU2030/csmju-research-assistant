/* eslint-disable no-control-regex -- Reject literal control characters in redirect paths. */
/** Core token only; no subsystem session database. */
export function ssoCookieNames(subsystemId = 'csmju-research-assistant') {
  const prefix = subsystemId.replace(/-/g, '_');
  return { access: `${prefix}_access_token`, state: `${prefix}_sso_state` };
}
export const SSO_COOKIE_NAME = ssoCookieNames().access;
export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()) || null; }
    catch { return null; }
  }
  return null;
}
export function cookie(name: string, value: string, age: number, secure: boolean, path = '/') {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(age))}${secure ? '; Secure' : ''}`;
}
export function buildSsoCookie(token: string, age: number, secure: boolean) {
  return cookie(SSO_COOKIE_NAME, token, age, secure);
}
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 ||
      !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(value)) return '/';
  try {
    const base = 'https://subsystem.invalid';
    const url = new URL(value, base);
    let pathname = decodeURIComponent(url.pathname);
    if (/[\\\x00-\x1f\x7f]/.test(pathname) || pathname.startsWith('//')) return '/';
    pathname = new URL(pathname, base).pathname;
    if (url.origin !== base || pathname === '/auth' || pathname.startsWith('/auth/')) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}

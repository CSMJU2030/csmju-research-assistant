/**
 * Fail fast on a misconfigured deployment instead of silently falling back to
 * development defaults in production.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  const required = isProduction
    ? ['DATABASE_URL', 'CORE_HUB_URL', 'CORE_HUB_ISSUER', 'CORE_HUB_AUDIENCE']
    : ['DATABASE_URL'];

  const missing = required.filter((key) => {
    const value = config[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const db = new URL(String(config.DATABASE_URL));
  if (!['postgresql:', 'postgres:'].includes(db.protocol) || !db.pathname.slice(1) || decodeURIComponent(db.pathname.slice(1)) === 'core_hub') {
    throw new Error('DATABASE_URL must point to the dedicated research assistant PostgreSQL database');
  }
  const coreUrl = String(config.CORE_HUB_URL ?? 'http://localhost:3000');
  const jwksUrl = String(config.CORE_HUB_JWKS_URL ?? `${coreUrl.replace(/\/+$/, '')}/api/v1/.well-known/jwks.json`);
  for (const value of [coreUrl, jwksUrl]) {
    if (!['http:', 'https:'].includes(new URL(value).protocol)) throw new Error('Core Hub URLs must use HTTP(S)');
  }
  const webUrl = String(config.CORE_HUB_WEB_URL ?? coreUrl);
  if (!['http:', 'https:'].includes(new URL(webUrl).protocol)) throw new Error('CORE_HUB_WEB_URL must use HTTP(S)');
  if (new URL(jwksUrl).origin !== new URL(coreUrl).origin) throw new Error('JWKS must belong to the same Core Hub origin');
  if (isProduction && [coreUrl, jwksUrl, webUrl].some(url => !url.startsWith('https://'))) {
    throw new Error('CORE_HUB_JWKS_URL must use HTTPS in production (spec §41.14)');
  }

  const subsystem = String(config.SUBSYSTEM_ID ?? 'csmju-research-assistant');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(subsystem) || subsystem === 'csmju') throw new Error('Invalid SUBSYSTEM_ID');
  return config;
}

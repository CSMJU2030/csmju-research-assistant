import { Controller, Get, Post, Headers, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { AppException } from '../common/errors';
import { AuthEventsLogger } from './auth-events.logger';
import { CoreHubTokenVerifier } from './core-hub-token.verifier';
import { Public } from './decorators/public.decorator';
import { mapCoreRoleToSubsystemRole } from './role-mapping';
import { cookie, readCookie, safeNext, ssoCookieNames } from './sso-session';

@Controller('auth')
export class SsoCallbackController {
  constructor(private readonly verifier: CoreHubTokenVerifier,
    private readonly authEvents: AuthEventsLogger, private readonly config: ConfigService) {}
  private get names() { return ssoCookieNames(this.config.get('subsystemId')); }
  private get secure() { return this.config.get('nodeEnv') === 'production'; }
  private headers(res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  @Public() @Get('login')
  login(@Query('next') next: unknown, @Res() res: Response) {
    this.headers(res);
    const state = randomBytes(32).toString('base64url');
    const saved = `${state}.${Buffer.from(safeNext(next)).toString('base64url')}`;
    res.setHeader('Set-Cookie', cookie(this.names.state, saved, 600, this.secure, '/auth/callback'));
    const url = new URL('/sso/authorize', this.config.get<string>('coreHub.webUrl')!);
    url.searchParams.set('subsystem', this.config.get<string>('subsystemId')!);
    url.searchParams.set('state', state);
    return res.redirect(302, url.toString());
  }
  @Public() @Get('callback')
  async callback(@Query() query: Record<string, unknown>, @Res() res: Response,
    @Headers('accept') accept?: string, @Headers('cookie') header?: string) {
    this.headers(res);
    // Burn the state on every response that carries a state, including malformed callbacks.
    if (query.state !== undefined) res.setHeader('Set-Cookie', cookie(this.names.state, '', 0, this.secure, '/auth/callback'));
    if (typeof query.access_token !== 'string' || !query.access_token) throw AppException.badRequest('Missing access_token');
    if (query.state === undefined) return res.redirect(302, '/auth/login');
    const saved = readCookie(header, this.names.state) ?? '';
    const [expected, encodedNext] = saved.split('.');
    const state = typeof query.state === 'string' ? query.state : '';
    const valid = state.length <= 512 && !!expected && Buffer.byteLength(state) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(state), Buffer.from(expected));
    if (!valid) {
      if (accept?.includes('text/html')) return res.status(401).type('html').send(
        '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>เข้าสู่ระบบอีกครั้ง</title><main><h1>การเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง</h1><p>กรุณาเริ่มเข้าสู่ระบบอีกครั้ง</p><a href="/auth/login">เข้าสู่ระบบอีกครั้ง</a></main></html>');
      throw AppException.unauthorized('Invalid or expired SSO state');
    }
    let payload;
    try { payload = await this.verifier.verify(query.access_token); }
    catch { throw AppException.unauthorized('Invalid Core Hub access token'); }
    const role = mapCoreRoleToSubsystemRole(payload.role);
    if (!role) throw AppException.forbidden('Your Core Hub role has no access to this subsystem');
    const lifetime = payload.exp! - Math.floor(Date.now() / 1000);
    if (lifetime <= 0) throw AppException.unauthorized('Expired Core Hub access token');
    res.append('Set-Cookie', cookie(this.names.access, query.access_token, lifetime, this.secure));
    const next = safeNext(Buffer.from(encodedNext ?? '', 'base64url').toString('utf8'));
    return res.redirect(302, next);
  }
  @Public() @Post('logout')
  logout(@Res() res: Response) {
    this.headers(res);
    res.setHeader('Set-Cookie', [cookie(this.names.access, '', 0, this.secure),
      cookie(this.names.state, '', 0, this.secure, '/auth/callback')]);
    return res.redirect(303, new URL('/logout', this.config.get<string>('coreHub.webUrl')!).toString());
  }
}

import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { SsoCallbackController } from './sso-callback.controller';
import { CoreHubTokenVerifier } from './core-hub-token.verifier';
import { AuthEventsLogger } from './auth-events.logger';
import { safeNext } from './sso-session';

function setup() {
  const config = new ConfigService({subsystemId: 'csmju-research-assistant', nodeEnv: 'production', coreHub: {webUrl: 'https://core.test'}});
  const verifier = {verify: jest.fn().mockResolvedValue({sub: 'teacher', role: 'lecturer', exp: Math.floor(Date.now()/1000)+900})};
  const headers: Record<string, string | string[]> = {};
  const res = {setHeader: jest.fn((k: string,v: string | string[])=>{headers[k]=v;}),
    append: jest.fn((k: string,v: string)=>{headers[k]=[headers[k] as string,v];}),
    redirect: jest.fn(), status: jest.fn(), type: jest.fn(), send: jest.fn()};
  res.status.mockReturnValue(res); res.type.mockReturnValue(res);
  const controller = new SsoCallbackController(verifier as unknown as CoreHubTokenVerifier, {} as AuthEventsLogger, config);
  return {controller, verifier, res: res as unknown as Response, mock: res, headers};
}
describe('Core SSO state flow', ()=> {
  it('sets secure state cookie and sends only subsystem and state to Core', ()=> {
    const {controller,res,mock,headers} = setup(); controller.login('/?tab=tasks',res);
    const url=new URL(mock.redirect.mock.calls[0][1]);
    expect(url.origin+url.pathname).toBe('https://core.test/sso/authorize');
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('subsystem')).toBe('csmju-research-assistant');
    expect(headers['Set-Cookie']).toContain('Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600; Secure');
    expect(headers['Cache-Control']).toBe('no-store');
  });
  it('discards a callback without state without setting or clearing any cookie', async()=> {
    const {controller,res,mock,headers,verifier}=setup();
    await controller.callback({access_token:'untrusted'},res);
    expect(mock.redirect).toHaveBeenCalledWith(302,'/auth/login');
    expect(headers['Set-Cookie']).toBeUndefined(); expect(verifier.verify).not.toHaveBeenCalled();
  });
  it('burns mismatched state and never verifies the supplied token', async()=> {
    const {controller,res,headers,verifier}=setup();
    await expect(controller.callback({access_token:'untrusted',state:'bad'},res,undefined,'csmju_research_assistant_sso_state=expected.Lw')).rejects.toMatchObject({status:401});
    expect(headers['Set-Cookie']).toContain('Max-Age=0'); expect(verifier.verify).not.toHaveBeenCalled();
  });
  it('accepts a matching state and lecturer and returns to the saved local page', async()=> {
    const {controller,res,mock,headers}=setup();
    controller.login('/?tab=tasks',res);
    const state=new URL(mock.redirect.mock.calls[0][1]).searchParams.get('state');
    const header=(headers['Set-Cookie'] as string).split(';')[0];
    await controller.callback({access_token:'verified-token',state},res,undefined,header);
    expect(mock.redirect).toHaveBeenLastCalledWith(302,'/?tab=tasks');
    expect((headers['Set-Cookie'] as string[])[1]).toContain('csmju_research_assistant_access_token=verified-token; Path=/; HttpOnly');
  });
  it('rejects disallowed role after clearing state',async()=> {
    const {controller,res,mock,headers,verifier}=setup(); controller.login('/',res);
    const state=new URL(mock.redirect.mock.calls[0][1]).searchParams.get('state');
    const header=(headers['Set-Cookie'] as string).split(';')[0]; verifier.verify.mockResolvedValue({sub:'alumni',role:'alumni',exp:Math.floor(Date.now()/1000)+900});
    await expect(controller.callback({access_token:'token',state},res,undefined,header)).rejects.toMatchObject({status:403});
    expect(mock.append).not.toHaveBeenCalled();
  });
  it('logout clears both cookie paths',()=> {const {controller,res,mock,headers}=setup();controller.logout(res);expect(headers['Set-Cookie']).toHaveLength(2);expect(mock.redirect).toHaveBeenCalledWith(303,'https://core.test/logout');});
  it.each(['https://evil.test','//evil.test','/%2f%2fevil.test','/\\evil.test','/auth/callback','/%61uth/login','/a/../auth/login','/bad%0d%0aheader'])('blocks unsafe next %s',(next)=>expect(safeNext(next)).toBe('/'));
});

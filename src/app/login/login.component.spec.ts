import '@angular/compiler';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { LoginComponent } from './login.component';

describe('LoginComponent characterization', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key))
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
  const cdr = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
  let session: SessionService;
  const auth = { login: vi.fn<AuthService['login']>() };

  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
    auth.login.mockReset();
    vi.stubGlobal('localStorage', storage);
    session = new SessionService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends the login request, stores the returned session and navigates', async () => {
    const user = { username: 'student', displayName: 'Student' };
    auth.login.mockResolvedValue({ token: 'fake-token', user });
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(auth.login).toHaveBeenCalledWith({
      username: 'student', password: 'Workshop123!', client: 'angular-workshop'
    });
    expect(session.getToken()).toBe('fake-token');
    expect(session.getUser()).toEqual(user);
    expect(values.has('workshop_token')).toBe(false);
    expect(values.has('workshop_user')).toBe(false);
    expect(values.has('workshop_preferences')).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it('merges saved preferences over the defaults', () => {
    values.set('workshop_preferences', JSON.stringify({ compact: true }));

    const component = new LoginComponent(router, session, auth, cdr);

    expect(component.preferences).toEqual({ theme: 'light', showTips: true, compact: true });
  });

  it('shows a validation message and skips the request when username is empty', async () => {
    const component = new LoginComponent(router, session, auth, cdr);
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('Ingrese un usuario.');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('shows a validation message and skips the request when password is empty', async () => {
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';

    await component.login();

    expect(component.message).toBe('Ingrese una contraseña.');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('treats whitespace-only credentials as empty', async () => {
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = '   ';

    await component.login();

    expect(component.message).toBe('Ingrese un usuario.');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('shows a message when the response does not contain a token', async () => {
    auth.login.mockResolvedValue({ user: { username: 'student' } });
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('El backend respondió sin token.');
    expect(component.busy).toBe(false);
  });

  it('does not expose the submitted username or server error in the message', async () => {
    auth.login.mockRejectedValue(new Error('internal server detail'));
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'invalid';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
    expect(component.message).not.toContain('student');
    expect(component.message).not.toContain('internal server detail');
    expect(component.busy).toBe(false);
  });

  it('does not expose markup-like backend details to the user', async () => {
    auth.login.mockRejectedValue({ response: { data: { message: '<em>fake detail</em>' } } });
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = '<student>';
    component.password = 'invalid';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
    expect(component.message).not.toContain('<student>');
    expect(component.message).not.toContain('<em>fake detail</em>');
  });

  it.each([
    ['backend caido', { code: 'ERR_NETWORK', message: 'private connection detail' }],
    ['CORS', { code: 'ERR_NETWORK', message: 'private CORS detail' }],
    ['401', { response: { status: 401, data: { message: 'private detail' } } }],
    ['403', { response: { status: 403 } }],
    ['500', { response: { status: 500 } }],
    ['timeout', { code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }]
  ])('handles %s without leaking details or navigating', async (_name, error) => {
    vi.mocked(auth.login).mockRejectedValue(error);
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'invalid';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
    expect(component.busy).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(session.getToken()).toBeNull();
    expect(auth.login).toHaveBeenCalledTimes(1);
  });

  it('keeps busy until the simulated 5000 ms timeout and then releases it', async () => {
    vi.useFakeTimers();
    vi.mocked(auth.login).mockImplementation(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject({ code: 'ECONNABORTED' }), 5000);
    }));
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'invalid';

    const pending = component.login();
    expect(component.busy).toBe(true);
    await vi.advanceTimersByTimeAsync(4999);
    expect(component.busy).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(component.busy).toBe(false);
    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
  });

  it.each([undefined, null])('handles unexpected response %s safely', async (response) => {
    vi.mocked(auth.login).mockResolvedValue(response);
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'invalid';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
    expect(component.busy).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each([{}, { token: '' }, { token: null }, { token: false }])(
    'does not create a session for a missing or falsy token: %j', async (response) => {
      vi.mocked(auth.login).mockResolvedValue(response as never);
      const component = new LoginComponent(router, session, auth, cdr);
      component.username = 'student';
      component.password = 'invalid';

      await component.login();

      expect(component.message).toBe('El backend respondió sin token.');
      expect(session.getToken()).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.busy).toBe(false);
    }
  );

  it('rejects a whitespace-only password without sending HTTP', async () => {
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = '   ';

    await component.login();

    expect(component.message).toBe('Ingrese una contraseña.');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('accepts a token without user data using the documented empty user fallback', async () => {
    vi.mocked(auth.login).mockResolvedValue({ token: 'fake-token' });
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(session.getUser()).toEqual({});
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it.each(['storage', 'navigation'])('reports %s failure after successful authentication', async (failure) => {
    vi.mocked(auth.login).mockResolvedValue({ token: 'fake-token', user: { username: 'student' } });
    if (failure === 'storage') {
      storage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    } else {
      vi.mocked(router.navigate).mockRejectedValueOnce(new Error('navigation rejected'));
    }
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
    expect(component.busy).toBe(false);
  });

  it('falls back to default preferences when stored JSON is corrupt', () => {
    values.set('workshop_preferences', '{');

    const component = new LoginComponent(router, session, auth, cdr);

    expect(component.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it.each([
    { token: 123 as unknown }, { token: true as unknown },
    { token: {} as unknown }, { token: [] as unknown }
  ])('BUG-T01: rejects a truthy non-string token: $token', async ({ token }) => {
    vi.mocked(auth.login).mockResolvedValue({ token } as never);
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'invalid';

    await component.login();

    expect(session.getToken()).toBeNull();
    expect(session.getUser()).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
    expect(component.busy).toBe(false);
  });

  it('BUG-T01: preserves the previous session when the returned token has an invalid type', async () => {
    const previousUser = { username: 'previous-student' };
    session.setSession('previous-fake-token', previousUser);
    vi.mocked(auth.login).mockResolvedValue({ token: 123, user: { username: 'student' } } as never);
    const component = new LoginComponent(router, session, auth, cdr);
    component.username = 'student';
    component.password = 'invalid';

    await component.login();

    expect(session.getToken()).toBe('previous-fake-token');
    expect(session.getUser()).toEqual(previousUser);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
    expect(component.message).toBe('No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.');
  });
});
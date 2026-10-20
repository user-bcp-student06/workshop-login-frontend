import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { LoginComponent } from '../login/login.component';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { TasksService } from './tasks.service';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('AuthService contract characterization', () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.get).mockReset();
  });

  it('posts the established login payload and timeout and returns the response data', async () => {
    const loginData = {
      token: 'fake-token',
      user: { username: 'student', displayName: 'Student' }
    };
    vi.mocked(axios.post).mockResolvedValue({ data: loginData } as never);
    const service = new AuthService();

    await expect(service.login({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    })).resolves.toEqual(loginData);

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
  });

  it.each([
    ['network', { code: 'ERR_NETWORK' }],
    ['timeout', { code: 'ECONNABORTED' }],
    ['unauthorized', { response: { status: 401 } }]
  ])('propagates %s to the component with the 5000 ms configuration intact', async (_name, error) => {
    vi.mocked(axios.post).mockRejectedValue(error);
    const request = { username: 'student', password: 'invalid', client: 'angular-workshop' as const };

    await expect(new AuthService().login(request)).rejects.toBe(error);

    expect(axios.post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/login', request, { timeout: 5000 }
    );
  });

  it('integrates login, bearer-authenticated tasks, logout and loss of session on reload', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    vi.stubGlobal('localStorage', storage);
    try {
      const user = { username: 'student', displayName: 'Student' };
      const task = { title: 'First', status: 'TODO', priority: 'high', owner: 'student' };
      vi.mocked(axios.post).mockResolvedValue({ status: 200, data: { token: 'fake-token', user } });
      vi.mocked(axios.get).mockResolvedValue({ status: 200, data: [task] });
      const navigate = vi.fn().mockResolvedValue(true);
      const router = { navigate } as unknown as Router;
      const detector = {
        detectChanges: vi.fn(),
        markForCheck: vi.fn()
      } as unknown as ChangeDetectorRef;
      const zone = { run: (callback: () => void) => callback() } as unknown as NgZone;
      const session = new SessionService();
      const login = new LoginComponent(router, session, new AuthService(), detector);
      login.username = 'student';
      login.password = 'Workshop123!';

      await login.login();
      expect(navigate).toHaveBeenCalledWith(['/dashboard']);
      const dashboard = new DashboardComponent(router, detector, zone, session, new TasksService());
      await dashboard.ngOnInit();

      expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
        headers: { Authorization: 'Bearer fake-token' }
      });
      expect(dashboard.visibleTasks).toEqual([{ ...task, label: 'HIGH · STUDENT' }]);
      expect(dashboard.error).toBe('');
      expect(dashboard.loading).toBe(false);
      expect(values.has('workshop_token')).toBe(false);
      expect(new SessionService().getToken()).toBeNull();

      await dashboard.logout();
      expect(session.getToken()).toBeNull();
      expect(session.getUser()).toBeNull();
      expect(values.has('workshop_preferences')).toBe(true);
      expect(navigate).toHaveBeenLastCalledWith(['/login']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
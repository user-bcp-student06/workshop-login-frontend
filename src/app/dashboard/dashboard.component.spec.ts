import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent characterization', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key))
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
  const changeDetector = { detectChanges: vi.fn() } as unknown as ChangeDetectorRef;
  const zone = { run: (callback: () => void) => callback() } as unknown as NgZone;
  let session: SessionService;
  const tasksService = { getTasks: vi.fn<TasksService['getTasks']>() };

  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
    tasksService.getTasks.mockReset();
    vi.stubGlobal('localStorage', storage);
    session = new SessionService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('redirects to login without requesting tasks when there is no token', async () => {
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    await component.ngOnInit();

    expect(tasksService.getTasks).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('loads bearer-authenticated tasks, filters archived tasks and sorts visible tasks', async () => {
    session.setSession('fake-token', { username: 'student' });
    tasksService.getTasks.mockResolvedValue([
      { title: 'Low', status: 'TODO', priority: 'low', owner: 'student' },
      { title: 'Archived', status: 'ARCHIVED', priority: 'urgent', owner: 'student' },
      { title: 'High', status: 'TODO', priority: 'high', owner: 'student' }
    ]);
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    await component.ngOnInit();

    expect(tasksService.getTasks).toHaveBeenCalledWith('student', 'fake-token');
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['Low', 'High']);
    expect(component.visibleTasks[1].label).toBe('HIGH · STUDENT');
    expect(component.loading).toBe(false);
  });

  it('clears the stored token and user on logout but retains preferences', async () => {
    session.setSession('fake-token', { username: 'student' });
    values.set('workshop_preferences', JSON.stringify({ compact: true }));
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    await component.logout();

    expect(session.getToken()).toBeNull();
    expect(session.getUser()).toBeNull();
    expect(values.has('workshop_preferences')).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows a generic error and stops loading when task retrieval fails', async () => {
    session.setSession('fake-token', { username: 'student' });
    tasksService.getTasks.mockRejectedValue(new Error('internal task service detail'));
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    await component.ngOnInit();

    expect(component.error).toBe('No se pudieron cargar las tareas. Intenta de nuevo.');
    expect(component.error).not.toContain('internal task service detail');
    expect(component.loading).toBe(false);
  });

  it.each([
    ['token invalido 401', { response: { status: 401 } }],
    ['token expirado 403', { response: { status: 403 } }],
    ['500', { response: { status: 500 } }],
    ['404', { response: { status: 404 } }],
    ['backend caido', { code: 'ERR_NETWORK' }],
    ['CORS', { code: 'ERR_NETWORK', message: 'private CORS detail' }],
    ['cancelacion', { code: 'ERR_CANCELED' }],
    ['timeout externo', { code: 'ECONNABORTED' }]
  ])('reports %s with no automatic redirect or retry', async (_name, error) => {
    session.setSession('fake-token', { username: 'student' });
    vi.mocked(tasksService.getTasks).mockRejectedValue(error);
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    await component.ngOnInit();

    expect(component.error).toBe('No se pudieron cargar las tareas. Intenta de nuevo.');
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(tasksService.getTasks).toHaveBeenCalledTimes(1);
  });

  it.each([
    { response: null }, { response: undefined }, { response: { tasks: [] } },
    { response: '' }, { response: [null] }
  ])(
    'reports an unexpected response without leaving loading active: $response', async ({ response }) => {
      session.setSession('fake-token', { username: 'student' });
      vi.mocked(tasksService.getTasks).mockResolvedValue(response as never);
      const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

      await component.ngOnInit();

      expect(component.error).toBe('No se pudieron cargar las tareas. Intenta de nuevo.');
      expect(component.loading).toBe(false);
      expect(component.visibleTasks).toEqual([]);
    }
  );

  it.each([
    { tasks: [] },
    { tasks: [{ title: 'Hidden', status: 'ARCHIVED', priority: 'high' }] }
  ])(
    'finishes successfully with no visible tasks: $tasks', async ({ tasks }) => {
      session.setSession('fake-token', { username: 'student' });
      vi.mocked(tasksService.getTasks).mockResolvedValue(tasks);
      const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

      await component.ngOnInit();

      expect(component.error).toBe('');
      expect(component.loading).toBe(false);
      expect(component.visibleTasks).toEqual([]);
    }
  );

  it('keeps loading while a task request is pending without an application timeout', async () => {
    vi.useFakeTimers();
    session.setSession('fake-token', {});
    let finish: (tasks: []) => void = () => undefined;
    vi.mocked(tasksService.getTasks).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    const pending = component.ngOnInit();
    await vi.advanceTimersByTimeAsync(60000);

    expect(component.loading).toBe(true);
    expect(component.error).toBe('');
    expect(tasksService.getTasks).toHaveBeenCalledWith('', 'fake-token');
    finish([]);
    await pending;
    expect(component.loading).toBe(false);
  });

  it.each([
    ['TODO', 'Por hacer'], ['in_progress', 'En progreso'], ['DONE', 'Completado'],
    ['RESUELTO', 'Resuelto'], ['COMPLETED', 'Completado'], ['OTHER', 'OTHER'], ['', '']
  ])('renders the documented label for %s', (status, expected) => {
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    expect(component.statusLabel(status)).toBe(expected);
    expect(component.statusValue(status)).toBe(status);
    expect(component.statusValue(status).toLowerCase()).toBe(status.toLowerCase());
  });

  it.each([
    { status: 123 as unknown }, { status: true as unknown },
    { status: {} as unknown }, { status: [] as unknown },
    { status: null as unknown }, { status: undefined as unknown }
  ])('BUG-T02: handles non-string status $status with an empty label', ({ status }) => {
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    expect(() => component.statusLabel(status)).not.toThrow();
    expect(component.statusLabel(status)).toBe('');
    expect(component.statusValue(status)).toBe('');
    expect('pill-' + component.statusValue(status).toLowerCase()).toBe('pill-');
  });

  it('BUG-T02: loads a task with numeric status and presents an empty label and safe CSS value', async () => {
    session.setSession('fake-token', { username: 'student' });
    vi.mocked(tasksService.getTasks).mockResolvedValue([
      { title: 'Unexpected status', status: 123, priority: 'high', owner: 'student' }
    ] as never);
    const component = new DashboardComponent(router, changeDetector, zone, session, tasksService);

    await component.ngOnInit();

    expect(component.loading).toBe(false);
    expect(component.error).toBe('');
    expect(component.visibleTasks).toHaveLength(1);
    const task = component.visibleTasks[0];
    expect(task.title).toBe('Unexpected status');
    expect(task.label).toBe('HIGH · STUDENT');
    expect(component.statusLabel(task.status)).toBe('');
    expect('pill-' + component.statusValue(task.status).toLowerCase()).toBe('pill-');
  });
});
import '@angular/compiler';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksService } from './tasks.service';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('TasksService contract characterization', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
  });

  it('gets tasks for the owner with the existing bearer authorization header', async () => {
    const tasks = [{ title: 'First', status: 'TODO', priority: 'high', owner: 'student' }];
    vi.mocked(axios.get).mockResolvedValue({ data: tasks } as never);
    const service = new TasksService();

    await expect(service.getTasks('student', 'fake-token')).resolves.toEqual(tasks);

    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer fake-token' }
    });
  });

  it.each(['', 'student & trainer'])('encodes owner %j and does not configure a timeout or body', async (owner) => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });

    await new TasksService().getTasks(owner, 'fake-token');

    expect(axios.get).toHaveBeenCalledExactlyOnceWith(
      `http://localhost:8000/api/tasks?owner=${encodeURIComponent(owner)}`,
      { headers: { Authorization: 'Bearer fake-token' } }
    );
  });

  it.each([
    ['backend caido', { code: 'ERR_NETWORK' }],
    ['token invalido', { response: { status: 401 } }],
    ['timeout externo', { code: 'ECONNABORTED' }]
  ])('propagates %s without retries', async (_name, error) => {
    vi.mocked(axios.get).mockRejectedValue(error);

    await expect(new TasksService().getTasks('student', 'fake-token')).rejects.toBe(error);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
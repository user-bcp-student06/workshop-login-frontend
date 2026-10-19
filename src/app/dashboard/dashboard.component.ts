import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TasksService } from '../services/tasks.service';
import { SessionService, SessionUser } from '../services/session.service';
import { formatTaskLabel } from '../utils/legacy-format';
import { Task } from '../models/task.model';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: SessionUser = {};
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private session: SessionService,
    private tasksService: TasksService
  ) {}

  statusValue(status: unknown): string {
    return typeof status === 'string' ? status : '';
  }

  statusLabel(status: unknown): string {
    const value = this.statusValue(status);
    return STATUS_LABELS[value.toUpperCase()] || value;
  }

  async ngOnInit(): Promise<void> {
    const token = this.session.getToken();
    this.user = this.session.getUser() || {};
    if (!token) {
      await this.router.navigate(['/login']);
      return;
    }
    try {
      const tasks = await this.tasksService.getTasks(this.user.username || '', token);
      const visibleTasks = tasks
        .filter((task) => task.status !== 'ARCHIVED')
        .map((task) => ({ ...task, label: formatTaskLabel(task) }))
        .sort((first, second) => first.priority > second.priority ? -1 : 1);
      // axios resuelve a veces fuera de la zona de Angular (más aún llegando
      // por navegación desde el login): forzamos volver a entrar a la zona
      // y disparamos detectChanges a mano para no depender de que Angular
      // lo detecte solo.
      this.zone.run(() => {
        this.tasks = tasks;
        this.visibleTasks = visibleTasks;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch {
      this.zone.run(() => {
        this.error = 'No se pudieron cargar las tareas. Intenta de nuevo.';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.session.clearSession();
    await this.router.navigate(['/login']);
  }
}

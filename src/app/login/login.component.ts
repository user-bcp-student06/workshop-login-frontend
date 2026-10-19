import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionService, UserPreferences } from '../services/session.service';
import { LoginRequest } from '../models/auth.model';

const LOGIN_ERROR_MESSAGE = 'No se pudo autenticar. Verifica tus credenciales e intenta de nuevo.';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message = '';
  preferences: UserPreferences = { theme: 'light', showTips: true, compact: false };

  constructor(
    private router: Router,
    private session: SessionService,
    private auth: AuthService
  ) {
    this.preferences = this.session.loadPreferences(this.preferences);
  }

  async login(): Promise<void> {
    this.message = '';
    if (!this.username.trim()) {
      this.message = 'Ingrese un usuario.';
      return;
    }
    if (!this.password.trim()) {
      this.message = 'Ingrese una contraseña.';
      return;
    }

    this.busy = true;
    try {
      const request: LoginRequest = {
        username: this.username,
        password: this.password,
        client: 'angular-workshop'
      };
      const response = await this.auth.login(request);
      if (!response.token) {
        this.message = 'El backend respondió sin token.';
        return;
      }
      if (typeof response.token !== 'string') {
        this.message = LOGIN_ERROR_MESSAGE;
        return;
      }

      this.session.setSession(response.token, response.user || {});
      this.session.savePreferences(this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch {
      this.message = LOGIN_ERROR_MESSAGE;
    } finally {
      this.busy = false;
    }
  }
}

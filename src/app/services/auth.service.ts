import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/auth.model';

const LOGIN_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await axios.post<LoginResponse>(
      `${environment.authApiUrl}/auth/login`,
      request,
      { timeout: LOGIN_TIMEOUT_MS }
    );
    return response.data;
  }
}
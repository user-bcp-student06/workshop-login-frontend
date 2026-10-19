import { SessionUser } from '../services/session.service';

export interface LoginRequest {
  username: string;
  password: string;
  client: 'angular-workshop';
}

export interface LoginResponse {
  token?: string;
  user?: SessionUser;
}
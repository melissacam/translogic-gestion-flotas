import type { Usuario } from '../types';
import { http } from './http';

export const authApi = {
  login: (email: string, password: string) =>
    http.post<{ accessToken: string; usuario: Usuario }>('/auth/login', { email, password }),
  perfil: () => http.get<Usuario>('/auth/perfil'),
};

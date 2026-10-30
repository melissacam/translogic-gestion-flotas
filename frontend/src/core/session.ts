import type { Rol, Usuario } from '../types';

const CLAVE_TOKEN = 'translogic.token';
const CLAVE_USUARIO = 'translogic.usuario';

// Token en sessionStorage: se borra al cerrar la pestaña
export const session = {
  guardar(token: string, usuario: Usuario): void {
    sessionStorage.setItem(CLAVE_TOKEN, token);
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  },

  token(): string | null {
    return sessionStorage.getItem(CLAVE_TOKEN);
  },

  usuario(): Usuario | null {
    const crudo = sessionStorage.getItem(CLAVE_USUARIO);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as Usuario;
    } catch {
      return null;
    }
  },

  activa(): boolean {
    return Boolean(this.token() && this.usuario());
  },

  tieneRol(...roles: Rol[]): boolean {
    const u = this.usuario();
    return Boolean(u && roles.includes(u.rol));
  },

  esAdmin(): boolean {
    return this.tieneRol('ADMINISTRADOR');
  },

  cerrar(): void {
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
  },
};

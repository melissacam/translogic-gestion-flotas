import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Rol } from '../enums';

export interface UsuarioJwt {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioJwt =>
    ctx.switchToHttp().getRequest<{ user: UsuarioJwt }>().user,
);

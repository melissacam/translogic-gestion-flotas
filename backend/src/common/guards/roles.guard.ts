import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UsuarioJwt } from '../decorators/usuario-actual.decorator';
import { Rol } from '../enums';

// Autorización por rol: sin @Roles basta con estar autenticado
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const usuario = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioJwt }>().user;
    if (!usuario || !roles.includes(usuario.rol)) {
      throw new ForbiddenException('No tiene permisos para esta operación');
    }
    return true;
  }
}

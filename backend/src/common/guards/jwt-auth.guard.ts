import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ES_PUBLICO } from '../decorators/publico.decorator';

// Guard global: toda ruta exige JWT salvo las marcadas con @Publico()
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (publico) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user)
      throw new UnauthorizedException('Sesión no válida o expirada');
    return user;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuarioJwt } from '../../common/decorators/usuario-actual.decorator';
import { Rol } from '../../common/enums';

interface PayloadJwt {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
}

// JWT Bearer firmado con JWT_SECRET; la expiración la verifica passport-jwt
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: PayloadJwt): UsuarioJwt {
    return {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuarios.buscarPorEmailConHash(dto.email);
    const valido =
      usuario?.activo &&
      (await bcrypt.compare(dto.password, usuario.passwordHash));
    // Mensaje genérico: no revela si el correo existe
    if (!usuario || !valido)
      throw new UnauthorizedException('Credenciales inválidas');

    const accessToken = await this.jwt.signAsync({
      sub: usuario._id.toString(),
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    });
    return {
      accessToken,
      usuario: {
        id: usuario._id.toString(),
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    };
  }

  perfil(id: string) {
    return this.usuarios.perfil(id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { Rol } from '../common/enums';
import { UsuariosRepository } from './usuarios.repository';

// 12 rondas de bcrypt: costo suficiente contra fuerza bruta sin castigar el login
export const RONDAS_BCRYPT = 12;

@Injectable()
export class UsuariosService {
  constructor(private readonly repo: UsuariosRepository) {}

  buscarPorEmailConHash(email: string) {
    return this.repo.buscarPorEmailConHash(email);
  }

  async perfil(id: string) {
    const usuario = await this.repo.buscarPorId(id);
    if (!usuario || !usuario.activo)
      throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  listar() {
    return this.repo.listar();
  }

  async crear(nombre: string, email: string, password: string, rol: Rol) {
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    const creado = await this.repo.crear({
      nombre,
      email,
      passwordHash,
      rol,
      activo: true,
    });
    return this.repo.buscarPorId(creado._id.toString());
  }
}

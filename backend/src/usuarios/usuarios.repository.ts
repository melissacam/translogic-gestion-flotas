import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario } from './schemas/usuario.schema';

@Injectable()
export class UsuariosRepository {
  constructor(
    @InjectModel(Usuario.name) private readonly modelo: Model<Usuario>,
  ) {}

  buscarPorEmailConHash(email: string) {
    return this.modelo
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .lean();
  }

  buscarPorId(id: string) {
    return this.modelo.findById(id).lean();
  }

  listar() {
    return this.modelo.find().sort({ nombre: 1 }).lean();
  }

  crear(datos: Omit<Usuario, '_id'>) {
    return this.modelo.create(datos);
  }
}

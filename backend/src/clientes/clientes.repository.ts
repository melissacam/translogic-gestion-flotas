import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Cliente } from './schemas/cliente.schema';

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ClientesRepository {
  constructor(
    @InjectModel(Cliente.name) private readonly modelo: Model<Cliente>,
  ) {}

  async listar(q: string | undefined, page: number, limit: number) {
    const filtro = q
      ? {
          $or: [
            { nombre: { $regex: escaparRegex(q), $options: 'i' } },
            { identificacion: { $regex: `^${escaparRegex(q)}` } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.modelo
        .find(filtro)
        .sort({ nombre: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.modelo.countDocuments(filtro),
    ]);
    return { data, total };
  }

  buscarPorId(id: string | Types.ObjectId, session?: ClientSession) {
    return this.modelo.findById(id, null, { session }).lean();
  }

  crear(datos: Partial<Cliente>) {
    return this.modelo.create(datos);
  }

  actualizar(id: string, datos: Partial<Cliente>) {
    return this.modelo
      .findByIdAndUpdate(
        id,
        { $set: datos },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
  }

  async tieneServicios(id: string): Promise<boolean> {
    const n = await this.modelo.db
      .collection('servicios')
      .countDocuments({ clienteId: new Types.ObjectId(id) }, { limit: 1 });
    return n > 0;
  }

  eliminar(id: string) {
    return this.modelo.deleteOne({ _id: id });
  }
}

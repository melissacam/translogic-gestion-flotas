import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { HistorialEstado } from './schemas/historial-estado.schema';

@Injectable()
export class HistorialRepository {
  constructor(
    @InjectModel(HistorialEstado.name)
    private readonly modelo: Model<HistorialEstado>,
  ) {}

  async registrar(
    datos: Omit<HistorialEstado, '_id'>,
    session?: ClientSession,
  ) {
    await this.modelo.create([datos], { session });
  }

  insertarVarios(datos: Omit<HistorialEstado, '_id'>[]) {
    return this.modelo.insertMany(datos);
  }

  // Historial de un servicio con el nombre del usuario que hizo cada cambio
  listarPorServicio(servicioId: string) {
    return this.modelo
      .aggregate([
        { $match: { servicioId: new Types.ObjectId(servicioId) } },
        { $sort: { fecha: 1, _id: 1 } },
        {
          $lookup: {
            from: 'usuarios',
            localField: 'usuarioId',
            foreignField: '_id',
            pipeline: [{ $project: { nombre: 1, rol: 1 } }],
            as: 'usuario',
          },
        },
        { $unwind: { path: '$usuario', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            estadoAnterior: 1,
            estadoNuevo: 1,
            fecha: 1,
            observacion: 1,
            usuarioId: 1,
            usuarioNombre: '$usuario.nombre',
            usuarioRol: '$usuario.rol',
          },
        },
      ])
      .exec();
  }
}

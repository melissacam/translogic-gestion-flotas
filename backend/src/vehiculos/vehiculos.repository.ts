import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { EstadoServicio, EstadoVehiculo, TipoVehiculo } from '../common/enums';
import {
  CamionCarga,
  FurgonetaElectrica,
  normalizarPlaca,
  Vehiculo,
  VehiculoLean,
} from './schemas/vehiculo.schema';

export interface FiltroVehiculos {
  tipo?: TipoVehiculo;
  estado?: EstadoVehiculo;
  placa?: string;
  asignables?: boolean;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class VehiculosRepository {
  private readonly modelosPorTipo: Record<TipoVehiculo, Model<VehiculoLean>>;

  constructor(
    @InjectModel(Vehiculo.name) private readonly modelo: Model<VehiculoLean>,
    @InjectModel(CamionCarga.name) camion: Model<VehiculoLean>,
    @InjectModel(FurgonetaElectrica.name) furgoneta: Model<VehiculoLean>,
  ) {
    this.modelosPorTipo = {
      [TipoVehiculo.CAMION_CARGA]: camion,
      [TipoVehiculo.FURGONETA_ELECTRICA]: furgoneta,
    };
  }

  private construirFiltro(f: FiltroVehiculos) {
    const filtro: Record<string, unknown> = {};
    if (f.tipo) filtro.tipo = f.tipo;
    if (f.estado) filtro.estado = f.estado;
    if (f.asignables) {
      filtro.estado = {
        $in: [EstadoVehiculo.DISPONIBLE, EstadoVehiculo.EN_SERVICIO],
      };
    }
    if (f.placa)
      filtro.placa = {
        $regex: escaparRegex(normalizarPlaca(f.placa)),
        $options: 'i',
      };
    return filtro;
  }

  async listar(f: FiltroVehiculos, page: number, limit: number) {
    const filtro = this.construirFiltro(f);
    const [data, total] = await Promise.all([
      this.modelo
        .find(filtro)
        .sort({ placa: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<VehiculoLean[]>(),
      this.modelo.countDocuments(filtro),
    ]);
    return { data, total };
  }

  buscarPorId(id: string | Types.ObjectId, session?: ClientSession) {
    return this.modelo.findById(id, null, { session }).lean<VehiculoLean>();
  }

  buscarPorPlaca(placa: string) {
    return this.modelo
      .findOne({ placa: normalizarPlaca(placa) })
      .lean<VehiculoLean>();
  }

  // Se crea con el modelo del discriminador para que valide los campos del subtipo
  crear(tipo: TipoVehiculo, datos: Record<string, unknown>) {
    return this.modelosPorTipo[tipo].create(datos);
  }

  actualizar(id: string, tipo: TipoVehiculo, set: Record<string, unknown>) {
    return this.modelosPorTipo[tipo]
      .findOneAndUpdate(
        { _id: id },
        { $set: set, $inc: { version: 1 } },
        { returnDocument: 'after', runValidators: true },
      )
      .lean<VehiculoLean>();
  }

  // Toque del documento vehículo: fuerza WriteConflict entre asignaciones simultáneas
  tocar(id: string | Types.ObjectId, session: ClientSession) {
    return this.modelo
      .findOneAndUpdate(
        { _id: id },
        { $inc: { version: 1 } },
        { session, returnDocument: 'after' },
      )
      .lean<VehiculoLean>();
  }

  cambiarEstado(
    id: Types.ObjectId | string,
    estado: EstadoVehiculo,
    session?: ClientSession,
  ) {
    return this.modelo.updateOne(
      { _id: id },
      { $set: { estado }, $inc: { version: 1 } },
      { session },
    );
  }

  // Suma de kilometraje y liberación del vehículo en la misma operación atómica
  sumarKilometraje(
    id: Types.ObjectId | string,
    km: number,
    session: ClientSession,
  ) {
    return this.modelo.updateOne(
      { _id: id },
      {
        $inc: { kilometraje: km, version: 1 },
        $set: { estado: EstadoVehiculo.DISPONIBLE },
      },
      { session },
    );
  }

  async tieneServiciosActivos(id: string): Promise<boolean> {
    const n = await this.modelo.db.collection('servicios').countDocuments(
      {
        vehiculoId: new Types.ObjectId(id),
        estado: {
          $in: [EstadoServicio.PROGRAMADO, EstadoServicio.EN_EJECUCION],
        },
      },
      { limit: 1 },
    );
    return n > 0;
  }

  // Eficiencia km/USD por agregación sobre servicios completados, comparada con su tipo
  async eficiencia(id: string) {
    const vehiculoId = new Types.ObjectId(id);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          estado: EstadoServicio.COMPLETADO,
          vehiculoId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$vehiculoId',
          serviciosCompletados: { $sum: 1 },
          kmRecorridos: { $sum: '$distanciaKm' },
          costoOperativoTotal: { $sum: '$costoOperativo' },
          ingresosTotales: { $sum: '$importe' },
        },
      },
      {
        $lookup: {
          from: 'vehiculos',
          localField: '_id',
          foreignField: '_id',
          as: 'v',
        },
      },
      { $unwind: '$v' },
      {
        $addFields: {
          tipo: '$v.tipo',
          eficienciaKmPorUsd: {
            $cond: [
              { $gt: ['$costoOperativoTotal', 0] },
              { $divide: ['$kmRecorridos', '$costoOperativoTotal'] },
              0,
            ],
          },
          costoPorKm: {
            $cond: [
              { $gt: ['$kmRecorridos', 0] },
              { $divide: ['$costoOperativoTotal', '$kmRecorridos'] },
              0,
            ],
          },
        },
      },
      // Promedio de la misma métrica dentro de su categoría (partición por tipo)
      {
        $setWindowFields: {
          partitionBy: '$tipo',
          output: { promedioCategoria: { $avg: '$eficienciaKmPorUsd' } },
        },
      },
      {
        $facet: {
          propio: [
            { $match: { _id: vehiculoId } },
            {
              $addFields: {
                clasificacion: {
                  $cond: [
                    { $gte: ['$eficienciaKmPorUsd', '$promedioCategoria'] },
                    'SOBRE_PROMEDIO',
                    'BAJO_PROMEDIO',
                  ],
                },
              },
            },
            { $project: { v: 0 } },
          ],
          categorias: [
            {
              $group: {
                _id: '$tipo',
                promedio: { $first: '$promedioCategoria' },
              },
            },
          ],
        },
      },
    ];
    const [resultado] = await this.modelo.db
      .collection('servicios')
      .aggregate(pipeline)
      .toArray();
    return resultado as {
      propio: Record<string, unknown>[];
      categorias: { _id: TipoVehiculo; promedio: unknown }[];
    };
  }
}

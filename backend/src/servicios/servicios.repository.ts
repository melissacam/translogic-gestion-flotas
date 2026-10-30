import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { EstadoServicio, TipoVehiculo } from '../common/enums';
import { ServicioTransporte } from './schemas/servicio.schema';

export type ServicioLean = ServicioTransporte;

export interface FiltroListado {
  estado?: EstadoServicio;
  clienteId?: string;
  vehiculoId?: string;
  tipoVehiculo?: TipoVehiculo;
  desde?: Date;
  hasta?: Date;
  codigo?: string;
  facturado?: boolean;
}

const ESTADOS_ACTIVOS = [
  EstadoServicio.PROGRAMADO,
  EstadoServicio.EN_EJECUCION,
];

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ServiciosRepository {
  constructor(
    @InjectModel(ServicioTransporte.name)
    private readonly modelo: Model<ServicioTransporte>,
  ) {}

  async crear(datos: Partial<ServicioTransporte>, session: ClientSession) {
    const [creado] = await this.modelo.create([datos], { session });
    return creado.toObject() as ServicioLean;
  }

  insertarVarios(datos: Partial<ServicioTransporte>[]) {
    return this.modelo.insertMany(datos);
  }

  buscarPorId(id: string | Types.ObjectId, session?: ClientSession) {
    return this.modelo.findById(id, null, { session }).lean<ServicioLean>();
  }

  buscarPorIds(ids: Types.ObjectId[], session?: ClientSession) {
    return this.modelo
      .find({ _id: { $in: ids } }, null, { session })
      .lean<ServicioLean[]>();
  }

  // Solapamiento: mismo vehículo, activo y con inicio < nuevoFin && fin > nuevoInicio
  buscarSolapado(
    vehiculoId: Types.ObjectId,
    inicio: Date,
    finEstimada: Date,
    excluirId: Types.ObjectId,
    session: ClientSession,
  ) {
    return this.modelo
      .findOne(
        {
          _id: { $ne: excluirId },
          vehiculoId,
          estado: { $in: ESTADOS_ACTIVOS },
          inicio: { $lt: finEstimada },
          finEstimada: { $gt: inicio },
        },
        { codigo: 1, inicio: 1, finEstimada: 1 },
        { session },
      )
      .lean<ServicioLean>();
  }

  buscarOtroEnEjecucion(
    vehiculoId: Types.ObjectId,
    excluirId: Types.ObjectId,
    session: ClientSession,
  ) {
    return this.modelo
      .findOne(
        {
          _id: { $ne: excluirId },
          vehiculoId,
          estado: EstadoServicio.EN_EJECUCION,
        },
        { codigo: 1 },
        { session },
      )
      .lean<ServicioLean>();
  }

  // Update condicional: solo aplica si el documento sigue como se leyó (estado + versión)
  async actualizarSiCoincide(
    condicion: Record<string, unknown>,
    set: Record<string, unknown>,
    session: ClientSession,
  ): Promise<boolean> {
    const r = await this.modelo.updateOne(
      condicion,
      { $set: set, $inc: { version: 1 } },
      { session },
    );
    return r.modifiedCount === 1;
  }

  // Factura: marca solo los que siguen COMPLETADO y sin factura; devuelve cuántos tomó
  async marcarFacturados(
    ids: Types.ObjectId[],
    facturaId: Types.ObjectId,
    session: ClientSession,
  ) {
    const r = await this.modelo.updateMany(
      { _id: { $in: ids }, estado: EstadoServicio.COMPLETADO, facturaId: null },
      { $set: { facturaId }, $inc: { version: 1 } },
      { session },
    );
    return r.modifiedCount;
  }

  contarCompletadosCliente(
    clienteId: Types.ObjectId,
    desde: Date,
    hasta: Date,
    session?: ClientSession,
  ) {
    return this.modelo.countDocuments(
      {
        clienteId,
        estado: EstadoServicio.COMPLETADO,
        fecha: { $gte: desde, $lte: hasta },
      },
      { session },
    );
  }

  // Listado paginado en el servidor: $match + $sort + $skip + $limit dentro de $facet
  async listar(
    f: FiltroListado,
    orden: Record<string, 1 | -1>,
    page: number,
    limit: number,
  ) {
    const match: Record<string, unknown> = {};
    if (f.estado) match.estado = f.estado;
    if (f.clienteId) match.clienteId = new Types.ObjectId(f.clienteId);
    if (f.vehiculoId) match.vehiculoId = new Types.ObjectId(f.vehiculoId);
    if (f.codigo)
      match.codigo = { $regex: escaparRegex(f.codigo.toUpperCase()) };
    if (f.desde || f.hasta) {
      match.fecha = {
        ...(f.desde ? { $gte: f.desde } : {}),
        ...(f.hasta ? { $lte: f.hasta } : {}),
      };
    }
    if (f.facturado !== undefined)
      match.facturaId = f.facturado ? { $ne: null } : null;

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'vehiculos',
          localField: 'vehiculoId',
          foreignField: '_id',
          pipeline: [{ $project: { placa: 1, tipo: 1, marca: 1, modelo: 1 } }],
          as: 'vehiculo',
        },
      },
      { $unwind: { path: '$vehiculo', preserveNullAndEmptyArrays: true } },
    ];
    if (f.tipoVehiculo)
      pipeline.push({ $match: { 'vehiculo.tipo': f.tipoVehiculo } });
    pipeline.push({
      $facet: {
        data: [
          { $sort: { ...orden, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'clientes',
              localField: 'clienteId',
              foreignField: '_id',
              pipeline: [{ $project: { nombre: 1, identificacion: 1 } }],
              as: 'cliente',
            },
          },
          { $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true } },
          { $project: { detalleCalculo: 0 } },
        ],
        total: [{ $count: 'n' }],
      },
    });
    const [r] = await this.modelo.aggregate<{
      data: unknown[];
      total: { n: number }[];
    }>(pipeline);
    return { data: r.data, total: r.total[0]?.n ?? 0 };
  }

  async detalle(id: string) {
    const [r] = await this.modelo.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'vehiculos',
          localField: 'vehiculoId',
          foreignField: '_id',
          pipeline: [
            { $project: { placa: 1, tipo: 1, marca: 1, modelo: 1, estado: 1 } },
          ],
          as: 'vehiculo',
        },
      },
      { $unwind: { path: '$vehiculo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'clientes',
          localField: 'clienteId',
          foreignField: '_id',
          pipeline: [{ $project: { nombre: 1, identificacion: 1 } }],
          as: 'cliente',
        },
      },
      { $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'facturas',
          localField: 'facturaId',
          foreignField: '_id',
          pipeline: [{ $project: { codigo: 1 } }],
          as: 'factura',
        },
      },
      { $unwind: { path: '$factura', preserveNullAndEmptyArrays: true } },
    ]);
    return r as Record<string, unknown> | undefined;
  }
}

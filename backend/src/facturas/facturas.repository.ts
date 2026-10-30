import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { DetalleFactura } from './schemas/detalle-factura.schema';
import { Factura } from './schemas/factura.schema';

@Injectable()
export class FacturasRepository {
  constructor(
    @InjectModel(Factura.name) private readonly facturas: Model<Factura>,
    @InjectModel(DetalleFactura.name)
    private readonly detalles: Model<DetalleFactura>,
  ) {}

  async crear(datos: Omit<Factura, '_id'>, session: ClientSession) {
    const [creada] = await this.facturas.create([datos], { session });
    return creada;
  }

  // Índice único servicioId: última barrera contra doble facturación (E11000 → 409)
  insertarDetalles(
    detalles: Omit<DetalleFactura, '_id'>[],
    session: ClientSession,
  ) {
    return this.detalles.insertMany(detalles, { session });
  }

  async listar(
    filtro: { clienteId?: string; mes?: string },
    page: number,
    limit: number,
  ) {
    const match: Record<string, unknown> = {};
    if (filtro.clienteId)
      match.clienteId = new Types.ObjectId(filtro.clienteId);
    if (filtro.mes) match.periodo = filtro.mes;
    const [r] = await this.facturas.aggregate<{
      data: unknown[];
      total: { n: number }[];
    }>([
      { $match: match },
      {
        $facet: {
          data: [
            { $sort: { fecha: -1, codigo: -1 } },
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
          ],
          total: [{ $count: 'n' }],
        },
      },
    ]);
    return { data: r.data, total: r.total[0]?.n ?? 0 };
  }

  async detalle(id: string) {
    const [r] = await this.facturas.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'clientes',
          localField: 'clienteId',
          foreignField: '_id',
          as: 'cliente',
        },
      },
      { $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'detalles_factura',
          localField: '_id',
          foreignField: 'facturaId',
          pipeline: [
            {
              $lookup: {
                from: 'servicios',
                localField: 'servicioId',
                foreignField: '_id',
                pipeline: [
                  {
                    $project: {
                      origen: 1,
                      destino: 1,
                      distanciaKm: 1,
                      inicio: 1,
                    },
                  },
                ],
                as: 'servicio',
              },
            },
            {
              $unwind: { path: '$servicio', preserveNullAndEmptyArrays: true },
            },
            { $sort: { codigoServicio: 1 } },
          ],
          as: 'detalles',
        },
      },
    ]);
    return r as Record<string, unknown> | undefined;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, PipelineStage, Types } from 'mongoose';
import { EstadoServicio, EstadoVehiculo, TipoVehiculo } from '../common/enums';

const COMPLETADO = EstadoServicio.COMPLETADO;
const CERO = Types.Decimal128.fromString('0');

// margen = utilidad / ingresos × 100; si ingresos = 0 → 0 (evita división por cero)
export function expresionMargen(ingresos: string, utilidad: string) {
  return {
    $cond: [
      { $eq: [ingresos, 0] },
      0,
      { $multiply: [{ $divide: [utilidad, ingresos] }, 100] },
    ],
  };
}

const lookupVehiculo: PipelineStage[] = [
  {
    $lookup: {
      from: 'vehiculos',
      localField: '_id',
      foreignField: '_id',
      pipeline: [{ $project: { placa: 1, tipo: 1, marca: 1, modelo: 1 } }],
      as: 'vehiculo',
    },
  },
  { $unwind: '$vehiculo' },
];

const lookupCliente: PipelineStage[] = [
  {
    $lookup: {
      from: 'clientes',
      localField: '_id',
      foreignField: '_id',
      pipeline: [{ $project: { nombre: 1, identificacion: 1 } }],
      as: 'cliente',
    },
  },
  { $unwind: '$cliente' },
];

// Todas las consultas se resuelven en MongoDB con aggregation framework (nada se suma en JS)
@Injectable()
export class ReportesRepository {
  constructor(@InjectConnection() private readonly conexion: Connection) {}

  private servicios() {
    return this.conexion.collection('servicios');
  }

  // Consulta 1: servicios cuyo costo operativo supera el promedio de los completados
  consulta1() {
    return this.servicios()
      .aggregate([
        { $match: { estado: COMPLETADO } },
        {
          $lookup: {
            from: 'servicios',
            pipeline: [
              { $match: { estado: COMPLETADO } },
              { $group: { _id: null, promedio: { $avg: '$costoOperativo' } } },
            ],
            as: 'referencia',
          },
        },
        { $unwind: '$referencia' },
        {
          $match: {
            $expr: { $gt: ['$costoOperativo', '$referencia.promedio'] },
          },
        },
        {
          $lookup: {
            from: 'vehiculos',
            localField: 'vehiculoId',
            foreignField: '_id',
            pipeline: [{ $project: { placa: 1, tipo: 1 } }],
            as: 'vehiculo',
          },
        },
        { $unwind: { path: '$vehiculo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            codigo: 1,
            fecha: 1,
            origen: 1,
            destino: 1,
            distanciaKm: 1,
            costoOperativo: 1,
            promedioCompletados: '$referencia.promedio',
            diferencia: {
              $subtract: ['$costoOperativo', '$referencia.promedio'],
            },
            placa: '$vehiculo.placa',
            tipo: '$vehiculo.tipo',
          },
        },
        { $sort: { costoOperativo: -1 } },
      ])
      .toArray();
  }

  // Consulta 2: % de participación de cada vehículo en los servicios completados
  consulta2() {
    return this.servicios()
      .aggregate([
        { $match: { estado: COMPLETADO, vehiculoId: { $ne: null } } },
        {
          $group: {
            _id: '$vehiculoId',
            servicios: { $sum: 1 },
            ingresos: { $sum: '$importe' },
          },
        },
        {
          $setWindowFields: {
            sortBy: { servicios: -1 },
            output: {
              totalServicios: {
                $sum: '$servicios',
                window: { documents: ['unbounded', 'unbounded'] },
              },
            },
          },
        },
        {
          $addFields: {
            participacionPct: {
              $round: [
                {
                  $multiply: [
                    { $divide: ['$servicios', '$totalServicios'] },
                    100,
                  ],
                },
                2,
              ],
            },
          },
        },
        ...lookupVehiculo,
        {
          $project: {
            _id: 0,
            vehiculoId: '$_id',
            placa: '$vehiculo.placa',
            tipo: '$vehiculo.tipo',
            servicios: 1,
            totalServicios: 1,
            participacionPct: 1,
            ingresos: 1,
          },
        },
        { $sort: { servicios: -1, placa: 1 } },
      ])
      .toArray();
  }

  // Consulta 3: clientes con 3 o más servicios completados en el período
  consulta3(desde: Date, hasta: Date) {
    return this.servicios()
      .aggregate([
        { $match: { estado: COMPLETADO, fecha: { $gte: desde, $lte: hasta } } },
        {
          $group: {
            _id: '$clienteId',
            completados: { $sum: 1 },
            kmTotales: { $sum: '$distanciaKm' },
            ingresos: { $sum: '$importe' },
          },
        },
        { $match: { completados: { $gte: 3 } } },
        ...lookupCliente,
        {
          $project: {
            _id: 0,
            clienteId: '$_id',
            nombre: '$cliente.nombre',
            identificacion: '$cliente.identificacion',
            completados: 1,
            kmTotales: 1,
            ingresos: 1,
          },
        },
        { $sort: { completados: -1, nombre: 1 } },
      ])
      .toArray();
  }

  // Consulta 4: vehículos sin servicios asignados que se crucen con el rango
  consulta4(desde: Date, hasta: Date) {
    return this.conexion
      .collection('vehiculos')
      .aggregate([
        { $match: { estado: { $ne: EstadoVehiculo.INACTIVO } } },
        {
          $lookup: {
            from: 'servicios',
            let: { vid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$vehiculoId', '$$vid'] },
                      { $ne: ['$estado', EstadoServicio.CANCELADO] },
                      { $lt: ['$inicio', hasta] },
                      { $gt: ['$finEstimada', desde] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'asignados',
          },
        },
        { $match: { asignados: { $size: 0 } } },
        {
          $project: {
            placa: 1,
            tipo: 1,
            marca: 1,
            modelo: 1,
            estado: 1,
            kilometraje: 1,
          },
        },
        { $sort: { placa: 1 } },
      ])
      .toArray();
  }

  // Consulta 5: top 5 vehículos por rentabilidad (ingresos, costos, utilidad y margen)
  consulta5() {
    return this.servicios()
      .aggregate([
        { $match: { estado: COMPLETADO, vehiculoId: { $ne: null } } },
        {
          $group: {
            _id: '$vehiculoId',
            servicios: { $sum: 1 },
            ingresos: { $sum: '$importe' },
            costos: { $sum: '$costoOperativo' },
          },
        },
        { $addFields: { utilidad: { $subtract: ['$ingresos', '$costos'] } } },
        { $addFields: { margen: expresionMargen('$ingresos', '$utilidad') } },
        { $sort: { utilidad: -1 } },
        { $limit: 5 },
        ...lookupVehiculo,
        {
          $project: {
            _id: 0,
            vehiculoId: '$_id',
            placa: '$vehiculo.placa',
            tipo: '$vehiculo.tipo',
            servicios: 1,
            ingresos: 1,
            costos: 1,
            utilidad: 1,
            margen: 1,
          },
        },
      ])
      .toArray();
  }

  // Consulta 6: facturación mensual por tipo de vehículo (detalles → servicios → vehículos)
  consulta6(zona: string, desde?: Date, hasta?: Date) {
    const rango: Record<string, unknown> = {};
    if (desde) rango.$gte = desde;
    if (hasta) rango.$lte = hasta;
    return this.conexion
      .collection('detalles_factura')
      .aggregate([
        {
          $lookup: {
            from: 'facturas',
            localField: 'facturaId',
            foreignField: '_id',
            pipeline: [{ $project: { fecha: 1 } }],
            as: 'factura',
          },
        },
        { $unwind: '$factura' },
        ...(desde || hasta ? [{ $match: { 'factura.fecha': rango } }] : []),
        {
          $lookup: {
            from: 'servicios',
            localField: 'servicioId',
            foreignField: '_id',
            pipeline: [{ $project: { vehiculoId: 1 } }],
            as: 'servicio',
          },
        },
        { $unwind: '$servicio' },
        {
          $lookup: {
            from: 'vehiculos',
            localField: 'servicio.vehiculoId',
            foreignField: '_id',
            pipeline: [{ $project: { tipo: 1 } }],
            as: 'vehiculo',
          },
        },
        { $unwind: '$vehiculo' },
        {
          $group: {
            _id: {
              mes: {
                $dateToString: {
                  format: '%Y-%m',
                  date: '$factura.fecha',
                  timezone: zona,
                },
              },
              tipo: '$vehiculo.tipo',
            },
            facturado: { $sum: '$importe' },
            servicios: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            mes: '$_id.mes',
            tipo: '$_id.tipo',
            facturado: 1,
            servicios: 1,
          },
        },
        { $sort: { mes: 1, tipo: 1 } },
      ])
      .toArray();
  }

  // Consulta 7: vehículos con eficiencia km/USD menor al promedio de su categoría
  consulta7() {
    return this.servicios()
      .aggregate([
        { $match: { estado: COMPLETADO, vehiculoId: { $ne: null } } },
        {
          $group: {
            _id: '$vehiculoId',
            kmRecorridos: { $sum: '$distanciaKm' },
            costoOperativo: { $sum: '$costoOperativo' },
          },
        },
        ...lookupVehiculo,
        {
          $addFields: {
            tipo: '$vehiculo.tipo',
            eficienciaKmPorUsd: {
              $cond: [
                { $gt: ['$costoOperativo', 0] },
                { $divide: ['$kmRecorridos', '$costoOperativo'] },
                0,
              ],
            },
          },
        },
        {
          $setWindowFields: {
            partitionBy: '$tipo',
            output: { promedioCategoria: { $avg: '$eficienciaKmPorUsd' } },
          },
        },
        {
          $match: {
            $expr: { $lt: ['$eficienciaKmPorUsd', '$promedioCategoria'] },
          },
        },
        {
          $project: {
            _id: 0,
            vehiculoId: '$_id',
            placa: '$vehiculo.placa',
            tipo: 1,
            kmRecorridos: 1,
            costoOperativo: 1,
            eficienciaKmPorUsd: 1,
            promedioCategoria: 1,
          },
        },
        { $sort: { tipo: 1, eficienciaKmPorUsd: 1 } },
      ])
      .toArray();
  }

  // Consulta 8: clientes cuya facturación del mes bajó más de 20 % frente al mes anterior
  consulta8(
    mesAnterior: string,
    mes: string,
    inicioAnterior: Date,
    inicioMes: Date,
    inicioSiguiente: Date,
  ) {
    return this.conexion
      .collection('facturas')
      .aggregate([
        { $match: { periodo: { $in: [mesAnterior, mes] } } },
        {
          $group: {
            _id: { clienteId: '$clienteId', periodo: '$periodo' },
            total: { $sum: '$total' },
          },
        },
        {
          $project: {
            _id: 0,
            clienteId: '$_id.clienteId',
            total: 1,
            mesFecha: {
              $dateFromString: {
                dateString: { $concat: ['$_id.periodo', '-01'] },
              },
            },
          },
        },
        // Rellena el mes sin facturas con 0 para que $shift compare meses consecutivos
        {
          $densify: {
            field: 'mesFecha',
            partitionByFields: ['clienteId'],
            range: {
              step: 1,
              unit: 'month',
              bounds: [inicioAnterior, inicioSiguiente],
            },
          },
        },
        { $addFields: { total: { $ifNull: ['$total', CERO] } } },
        {
          $setWindowFields: {
            partitionBy: '$clienteId',
            sortBy: { mesFecha: 1 },
            output: {
              totalAnterior: {
                $shift: { output: '$total', by: -1, default: null },
              },
            },
          },
        },
        { $match: { mesFecha: inicioMes, totalAnterior: { $gt: 0 } } },
        {
          $addFields: {
            variacionPct: {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ['$total', '$totalAnterior'] },
                    '$totalAnterior',
                  ],
                },
                100,
              ],
            },
          },
        },
        { $match: { variacionPct: { $lt: -20 } } },
        {
          $lookup: {
            from: 'clientes',
            localField: 'clienteId',
            foreignField: '_id',
            pipeline: [{ $project: { nombre: 1, identificacion: 1 } }],
            as: 'cliente',
          },
        },
        { $unwind: '$cliente' },
        {
          $project: {
            clienteId: 1,
            nombre: '$cliente.nombre',
            identificacion: '$cliente.identificacion',
            mes: { $literal: mes },
            mesAnterior: { $literal: mesAnterior },
            totalMes: '$total',
            totalMesAnterior: '$totalAnterior',
            variacionPct: 1,
          },
        },
        { $sort: { variacionPct: 1 } },
      ])
      .toArray();
  }

  // Dashboard en una sola consulta: $facet con KPIs, estados, tipos, 12 meses y vehículos
  async rentabilidad(
    desdeAnio: Date,
    hastaAnio: Date,
    zona: string,
    mes?: number,
    tipo?: TipoVehiculo,
  ) {
    const delMes: PipelineStage.FacetPipelineStage[] = mes
      ? [{ $match: { mes } }]
      : [];
    const completadosDelPeriodo: PipelineStage.FacetPipelineStage[] = [
      { $match: { estado: COMPLETADO } },
      ...delMes,
    ];
    const [r] = await this.servicios()
      .aggregate([
        { $match: { fecha: { $gte: desdeAnio, $lte: hastaAnio } } },
        {
          $lookup: {
            from: 'vehiculos',
            localField: 'vehiculoId',
            foreignField: '_id',
            pipeline: [{ $project: { placa: 1, tipo: 1 } }],
            as: 'vehiculo',
          },
        },
        { $unwind: { path: '$vehiculo', preserveNullAndEmptyArrays: true } },
        ...(tipo ? [{ $match: { 'vehiculo.tipo': tipo } }] : []),
        { $addFields: { mes: { $month: { date: '$fecha', timezone: zona } } } },
        {
          $facet: {
            kpis: [
              ...completadosDelPeriodo,
              {
                $group: {
                  _id: null,
                  ingresos: { $sum: '$importe' },
                  costos: { $sum: '$costoOperativo' },
                  servicios: { $sum: 1 },
                },
              },
              {
                $addFields: {
                  utilidad: { $subtract: ['$ingresos', '$costos'] },
                },
              },
              {
                $addFields: {
                  margen: expresionMargen('$ingresos', '$utilidad'),
                },
              },
              { $project: { _id: 0 } },
            ],
            serviciosPorEstado: [
              ...delMes,
              { $group: { _id: '$estado', cantidad: { $sum: 1 } } },
              { $project: { _id: 0, estado: '$_id', cantidad: 1 } },
              { $sort: { estado: 1 } },
            ],
            distribucionPorTipo: [
              ...completadosDelPeriodo,
              { $match: { 'vehiculo.tipo': { $ne: null } } },
              {
                $group: {
                  _id: '$vehiculo.tipo',
                  servicios: { $sum: 1 },
                  ingresos: { $sum: '$importe' },
                  costos: { $sum: '$costoOperativo' },
                },
              },
              {
                $project: {
                  _id: 0,
                  tipo: '$_id',
                  servicios: 1,
                  ingresos: 1,
                  costos: 1,
                },
              },
              { $sort: { tipo: 1 } },
            ],
            comparacionMensual: [
              { $match: { estado: COMPLETADO } },
              {
                $group: {
                  _id: '$mes',
                  ingresos: { $sum: '$importe' },
                  costos: { $sum: '$costoOperativo' },
                },
              },
              { $group: { _id: null, meses: { $push: '$$ROOT' } } },
              // Siempre 12 meses: los meses sin servicios completados quedan en 0
              {
                $project: {
                  _id: 0,
                  meses: {
                    $map: {
                      input: { $range: [1, 13] },
                      as: 'm',
                      in: {
                        $let: {
                          vars: {
                            f: {
                              $first: {
                                $filter: {
                                  input: '$meses',
                                  cond: { $eq: ['$$this._id', '$$m'] },
                                },
                              },
                            },
                          },
                          in: {
                            mes: '$$m',
                            ingresos: { $ifNull: ['$$f.ingresos', CERO] },
                            costos: { $ifNull: ['$$f.costos', CERO] },
                            utilidad: {
                              $subtract: [
                                { $ifNull: ['$$f.ingresos', CERO] },
                                { $ifNull: ['$$f.costos', CERO] },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              { $unwind: '$meses' },
              { $replaceRoot: { newRoot: '$meses' } },
            ],
            porVehiculo: [
              ...completadosDelPeriodo,
              { $match: { vehiculoId: { $ne: null } } },
              {
                $group: {
                  _id: '$vehiculoId',
                  placa: { $first: '$vehiculo.placa' },
                  tipo: { $first: '$vehiculo.tipo' },
                  servicios: { $sum: 1 },
                  kmRecorridos: { $sum: '$distanciaKm' },
                  ingresos: { $sum: '$importe' },
                  costos: { $sum: '$costoOperativo' },
                },
              },
              {
                $addFields: {
                  utilidad: { $subtract: ['$ingresos', '$costos'] },
                },
              },
              {
                $addFields: {
                  margen: expresionMargen('$ingresos', '$utilidad'),
                },
              },
              {
                $project: {
                  _id: 0,
                  vehiculoId: '$_id',
                  placa: 1,
                  tipo: 1,
                  servicios: 1,
                  kmRecorridos: 1,
                  ingresos: 1,
                  costos: 1,
                  utilidad: 1,
                  margen: 1,
                },
              },
              { $sort: { utilidad: -1 } },
            ],
          },
        },
      ])
      .toArray();
    return r;
  }
}

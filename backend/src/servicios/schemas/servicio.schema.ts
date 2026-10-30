import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { EstadoServicio } from '../../common/enums';

@Schema({ collection: 'servicios', versionKey: false, timestamps: true })
export class ServicioTransporte {
  _id: Types.ObjectId;

  // Índice único { codigo: 1 } (migración 002): códigos duplicados → 409
  @Prop({ required: true, uppercase: true, trim: true })
  codigo: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Cliente' })
  clienteId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vehiculo', default: null })
  vehiculoId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  origen: string;

  @Prop({ required: true, trim: true })
  destino: string;

  @Prop({ required: true, min: 0.01 })
  distanciaKm: number;

  @Prop({ required: true, min: 0 })
  pesoCargaKg: number;

  // Inicio del día local (ZONA_HORARIA) expresado en UTC
  @Prop({ required: true })
  fecha: Date;

  @Prop({ required: true })
  horaInicio: string;

  @Prop({ required: true })
  horaFinEstimada: string;

  @Prop({ required: true })
  inicio: Date;

  @Prop({ required: true })
  finEstimada: Date;

  @Prop({
    type: String,
    enum: EstadoServicio,
    required: true,
    default: EstadoServicio.PROGRAMADO,
  })
  estado: EstadoServicio;

  @Prop({ default: false })
  recargaPlanificada: boolean;

  @Prop({ type: Types.Decimal128, default: null })
  costoOperativo: Types.Decimal128 | null;

  @Prop({ type: Types.Decimal128, default: null })
  tarifa: Types.Decimal128 | null;

  @Prop({ type: Types.Decimal128, default: null })
  recargos: Types.Decimal128 | null;

  @Prop({ type: Types.Decimal128, default: null })
  importe: Types.Decimal128 | null;

  // Instantánea del cálculo: no cambia aunque luego cambien precios del vehículo
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  detalleCalculo: Record<string, unknown> | null;

  // Garantiza que el kilometraje se sume una sola vez al completar
  @Prop({ default: false })
  kilometrajeAplicado: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Factura', default: null })
  facturaId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  completadoEn: Date | null;

  // Bloqueo optimista: toda actualización exige la versión leída y la incrementa
  @Prop({ required: true, default: 0 })
  version: number;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  creadoPor?: Types.ObjectId;
}

export type ServicioDocument = HydratedDocument<ServicioTransporte>;
export const ServicioSchema = SchemaFactory.createForClass(ServicioTransporte);

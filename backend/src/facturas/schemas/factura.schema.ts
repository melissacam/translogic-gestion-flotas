import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ collection: 'facturas', versionKey: false, timestamps: true })
export class Factura {
  _id: Types.ObjectId;

  // FAC-AAAAMM-0001 generado con $inc atómico; índice único { codigo: 1 }
  @Prop({ required: true })
  codigo: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Cliente' })
  clienteId: Types.ObjectId;

  @Prop({ required: true })
  fecha: Date;

  @Prop({ required: true })
  periodo: string;

  @Prop({ type: Types.Decimal128, required: true })
  subtotal: Types.Decimal128;

  @Prop({ type: Types.Decimal128, required: true })
  recargos: Types.Decimal128;

  @Prop({ type: Types.Decimal128, required: true })
  base: Types.Decimal128;

  @Prop({ required: true })
  serviciosCompletadosMes: number;

  @Prop({ required: true })
  porcentajeDescuento: number;

  @Prop({ type: Types.Decimal128, required: true })
  descuento: Types.Decimal128;

  @Prop({ type: Types.Decimal128, required: true })
  baseImponible: Types.Decimal128;

  @Prop({ required: true })
  tasaImpuesto: number;

  @Prop({ type: Types.Decimal128, required: true })
  impuesto: Types.Decimal128;

  @Prop({ type: Types.Decimal128, required: true })
  total: Types.Decimal128;

  @Prop({ required: true })
  cantidadServicios: number;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  emitidaPor?: Types.ObjectId;
}

export const FacturaSchema = SchemaFactory.createForClass(Factura);

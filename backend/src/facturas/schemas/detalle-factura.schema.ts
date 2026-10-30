import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

// Colección aparte: índice único en servicioId = un servicio aparece en una sola factura
@Schema({ collection: 'detalles_factura', versionKey: false })
export class DetalleFactura {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Factura' })
  facturaId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'ServicioTransporte' })
  servicioId: Types.ObjectId;

  @Prop({ required: true })
  codigoServicio: string;

  @Prop({ type: Types.Decimal128, required: true })
  tarifa: Types.Decimal128;

  @Prop({ required: true })
  porcentajeRecargo: number;

  @Prop({ type: Types.Decimal128, required: true })
  recargos: Types.Decimal128;

  @Prop({ type: Types.Decimal128, required: true })
  importe: Types.Decimal128;
}

export const DetalleFacturaSchema =
  SchemaFactory.createForClass(DetalleFactura);

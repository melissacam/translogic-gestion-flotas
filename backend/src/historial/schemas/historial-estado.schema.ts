import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoServicio } from '../../common/enums';

// Colección aparte (append-only): la auditoría crece sin inflar el documento del servicio
@Schema({ collection: 'historial_estados', versionKey: false })
export class HistorialEstado {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'ServicioTransporte' })
  servicioId: Types.ObjectId;

  @Prop({ type: String, enum: EstadoServicio, default: null })
  estadoAnterior: EstadoServicio | null;

  @Prop({ type: String, enum: EstadoServicio, required: true })
  estadoNuevo: EstadoServicio;

  @Prop({ required: true })
  fecha: Date;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Usuario' })
  usuarioId: Types.ObjectId;

  @Prop({ trim: true })
  observacion?: string;
}

export const HistorialEstadoSchema =
  SchemaFactory.createForClass(HistorialEstado);

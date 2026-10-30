import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'clientes', versionKey: false, timestamps: true })
export class Cliente {
  _id: Types.ObjectId;

  // Cédula (10) o RUC (13); índice único { identificacion: 1 } en la migración 002
  @Prop({ required: true, trim: true })
  identificacion: string;

  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, lowercase: true, trim: true })
  correo: string;

  @Prop({ required: true, trim: true })
  telefono: string;

  @Prop({ trim: true })
  direccion?: string;
}

export type ClienteDocument = HydratedDocument<Cliente>;
export const ClienteSchema = SchemaFactory.createForClass(Cliente);

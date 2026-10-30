import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Rol } from '../../common/enums';

@Schema({ collection: 'usuarios', versionKey: false, timestamps: true })
export class Usuario {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombre: string;

  // Índice único { email: 1 } creado por la migración 002
  @Prop({ required: true, lowercase: true, trim: true, unique: true })
  email: string;

  // Hash bcrypt; select:false para que nunca salga en una consulta normal
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, enum: Rol, type: String })
  rol: Rol;

  @Prop({ default: true })
  activo: boolean;
}

export type UsuarioDocument = HydratedDocument<Usuario>;
export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

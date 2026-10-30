import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'contadores', versionKey: false })
export class Contador {
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true, default: 0 })
  secuencia: number;
}

export const ContadorSchema = SchemaFactory.createForClass(Contador);

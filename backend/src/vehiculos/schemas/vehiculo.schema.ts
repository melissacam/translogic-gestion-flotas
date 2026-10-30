import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EstadoVehiculo, TipoVehiculo } from '../../common/enums';

export function normalizarPlaca(placa: string): string {
  return String(placa).toUpperCase().replace(/\s+/g, '');
}

// Una sola colección `vehiculos`; `tipo` es la clave del discriminador de Mongoose
@Schema({
  collection: 'vehiculos',
  versionKey: false,
  timestamps: true,
  discriminatorKey: 'tipo',
})
export class Vehiculo {
  _id: Types.ObjectId;

  // Placa normalizada (mayúsculas, sin espacios); índice único { placa: 1 } en la migración 002
  @Prop({ required: true, set: normalizarPlaca })
  placa: string;

  @Prop({ required: true, trim: true })
  marca: string;

  @Prop({ required: true, trim: true })
  modelo: string;

  @Prop({ required: true, min: 1990 })
  anio: number;

  @Prop({ required: true, min: 1 })
  capacidadCargaKg: number;

  @Prop({ required: true, min: 0, default: 0 })
  kilometraje: number;

  @Prop({ required: true, enum: TipoVehiculo, type: String })
  tipo: TipoVehiculo;

  @Prop({
    required: true,
    enum: EstadoVehiculo,
    type: String,
    default: EstadoVehiculo.DISPONIBLE,
  })
  estado: EstadoVehiculo;

  // Control de concurrencia: cada asignación lo incrementa dentro de la transacción
  @Prop({ required: true, default: 0 })
  version: number;
}

@Schema()
export class CamionCarga {
  @Prop({ required: true, min: 0.1 })
  consumoLitros100Km: number;

  @Prop({ required: true, type: Types.Decimal128 })
  precioLitro: Types.Decimal128;

  @Prop({ required: true, min: 2 })
  numeroEjes: number;

  @Prop({ required: true, type: Types.Decimal128 })
  costoMantenimientoKm: Types.Decimal128;
}

@Schema()
export class FurgonetaElectrica {
  @Prop({ required: true, min: 1 })
  capacidadBateriaKWh: number;

  @Prop({ required: true, min: 0.1 })
  consumoKWh100Km: number;

  @Prop({ required: true, type: Types.Decimal128 })
  costoKWh: Types.Decimal128;

  @Prop({ required: true, min: 1 })
  autonomiaKm: number;

  @Prop({ required: true, min: 0, max: 100 })
  porcentajeBateria: number;
}

export type VehiculoDocument = HydratedDocument<Vehiculo>;
export const VehiculoSchema = SchemaFactory.createForClass(Vehiculo);

// Esquemas del discriminador: solo los campos propios de cada subtipo
export const CamionCargaSchema = SchemaFactory.createForClass(CamionCarga);
export const FurgonetaElectricaSchema =
  SchemaFactory.createForClass(FurgonetaElectrica);

export type VehiculoLean = Vehiculo &
  Partial<CamionCarga> &
  Partial<FurgonetaElectrica>;

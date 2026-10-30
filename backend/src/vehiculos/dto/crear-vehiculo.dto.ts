import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoVehiculo } from '../../common/enums';
import { normalizarPlaca } from '../schemas/vehiculo.schema';

export const ANIO_MAXIMO = new Date().getFullYear() + 1;
const esCamion = (o: { tipo?: TipoVehiculo }) =>
  o.tipo === TipoVehiculo.CAMION_CARGA;
const esFurgoneta = (o: { tipo?: TipoVehiculo }) =>
  o.tipo === TipoVehiculo.FURGONETA_ELECTRICA;
const NUM = { maxDecimalPlaces: 4 };

// DTO discriminado por `tipo`: @ValidateIf exige solo los campos del subtipo elegido
export class CrearVehiculoDto {
  @ApiProperty({ enum: TipoVehiculo, example: TipoVehiculo.CAMION_CARGA })
  @IsEnum(TipoVehiculo, { message: 'Tipo de vehículo inválido' })
  tipo: TipoVehiculo;

  @ApiProperty({
    example: 'GBA-1234',
    description: 'Se normaliza a mayúsculas sin espacios',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarPlaca(value) : value,
  )
  @Matches(/^[A-Z]{3}-?\d{3,4}$/, {
    message: 'Placa inválida (formato ABC-1234)',
  })
  placa: string;

  @ApiProperty({ example: 'Hino' })
  @IsString()
  @Length(2, 40)
  marca: string;

  @ApiProperty({ example: 'Serie 500' })
  @IsString()
  @Length(1, 40)
  modelo: string;

  @ApiProperty({ example: 2022, minimum: 1990 })
  @IsInt()
  @Min(1990, { message: 'El año debe ser 1990 o posterior' })
  @Max(ANIO_MAXIMO, { message: `El año no puede ser mayor a ${ANIO_MAXIMO}` })
  anio: number;

  @ApiProperty({ example: 10000 })
  @IsNumber(NUM)
  @IsPositive({ message: 'La capacidad de carga debe ser positiva' })
  capacidadCargaKg: number;

  @ApiPropertyOptional({ example: 0 })
  @ValidateIf((o: CrearVehiculoDto) => o.kilometraje !== undefined)
  @IsNumber(NUM)
  @Min(0)
  kilometraje?: number;

  @ApiPropertyOptional({ example: 30, description: 'Solo camión' })
  @ValidateIf(esCamion)
  @IsDefined({ message: 'consumoLitros100Km es obligatorio para camiones' })
  @IsNumber(NUM)
  @IsPositive()
  consumoLitros100Km?: number;

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Solo camión (USD por litro)',
  })
  @ValidateIf(esCamion)
  @IsDefined({ message: 'precioLitro es obligatorio para camiones' })
  @IsNumber(NUM)
  @IsPositive()
  precioLitro?: number;

  @ApiPropertyOptional({ example: 3, description: 'Solo camión' })
  @ValidateIf(esCamion)
  @IsDefined({ message: 'numeroEjes es obligatorio para camiones' })
  @IsInt()
  @Min(2)
  @Max(10)
  numeroEjes?: number;

  @ApiPropertyOptional({
    example: 0.1,
    description: 'Solo camión (USD por km)',
  })
  @ValidateIf(esCamion)
  @IsDefined({ message: 'costoMantenimientoKm es obligatorio para camiones' })
  @IsNumber(NUM)
  @IsPositive()
  costoMantenimientoKm?: number;

  @ApiPropertyOptional({ example: 60, description: 'Solo furgoneta' })
  @ValidateIf(esFurgoneta)
  @IsDefined({ message: 'capacidadBateriaKWh es obligatoria para furgonetas' })
  @IsNumber(NUM)
  @IsPositive()
  capacidadBateriaKWh?: number;

  @ApiPropertyOptional({ example: 20, description: 'Solo furgoneta' })
  @ValidateIf(esFurgoneta)
  @IsDefined({ message: 'consumoKWh100Km es obligatorio para furgonetas' })
  @IsNumber(NUM)
  @IsPositive()
  consumoKWh100Km?: number;

  @ApiPropertyOptional({
    example: 0.1,
    description: 'Solo furgoneta (USD por kWh)',
  })
  @ValidateIf(esFurgoneta)
  @IsDefined({ message: 'costoKWh es obligatorio para furgonetas' })
  @IsNumber(NUM)
  @IsPositive()
  costoKWh?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Solo furgoneta (km con batería al 100 %)',
  })
  @ValidateIf(esFurgoneta)
  @IsDefined({ message: 'autonomiaKm es obligatoria para furgonetas' })
  @IsNumber(NUM)
  @IsPositive()
  autonomiaKm?: number;

  @ApiPropertyOptional({
    example: 80,
    minimum: 0,
    maximum: 100,
    description: 'Solo furgoneta',
  })
  @ValidateIf(esFurgoneta)
  @IsDefined({ message: 'porcentajeBateria es obligatorio para furgonetas' })
  @IsNumber(NUM)
  @Min(0, { message: 'El porcentaje de batería debe estar entre 0 y 100' })
  @Max(100, { message: 'El porcentaje de batería debe estar entre 0 y 100' })
  porcentajeBateria?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { EstadoVehiculo } from '../../common/enums';
import { normalizarPlaca } from '../schemas/vehiculo.schema';
import { ANIO_MAXIMO } from './crear-vehiculo.dto';

export const ESTADOS_EDITABLES = [
  EstadoVehiculo.DISPONIBLE,
  EstadoVehiculo.MANTENIMIENTO,
] as const;

// Campos que un OPERADOR puede modificar (matriz de permisos)
export const CAMPOS_OPERADOR = new Set([
  'kilometraje',
  'porcentajeBateria',
  'estado',
]);

const NUM = { maxDecimalPlaces: 4 };

// El tipo no se edita; los campos de otro subtipo se rechazan en el servicio
export class ActualizarVehiculoDto {
  @ApiPropertyOptional({ example: 'GBA-1234' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarPlaca(value) : value,
  )
  @Matches(/^[A-Z]{3}-?\d{3,4}$/, {
    message: 'Placa inválida (formato ABC-1234)',
  })
  placa?: string;

  @ApiPropertyOptional({ example: 'Hino' })
  @IsOptional()
  @IsString()
  @Length(2, 40)
  marca?: string;

  @ApiPropertyOptional({ example: 'Serie 500' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  modelo?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  @Min(1990, { message: 'El año debe ser 1990 o posterior' })
  @Max(ANIO_MAXIMO, { message: `El año no puede ser mayor a ${ANIO_MAXIMO}` })
  anio?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  capacidadCargaKg?: number;

  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  kilometraje?: number;

  @ApiPropertyOptional({
    enum: ESTADOS_EDITABLES,
    example: EstadoVehiculo.MANTENIMIENTO,
  })
  @IsOptional()
  @IsIn(ESTADOS_EDITABLES, {
    message: 'Solo puede cambiarse a DISPONIBLE o MANTENIMIENTO',
  })
  estado?: EstadoVehiculo;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  consumoLitros100Km?: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  precioLitro?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  numeroEjes?: number;

  @ApiPropertyOptional({ example: 0.1 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  costoMantenimientoKm?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  capacidadBateriaKWh?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  consumoKWh100Km?: number;

  @ApiPropertyOptional({ example: 0.1 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  costoKWh?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber(NUM)
  @IsPositive()
  autonomiaKm?: number;

  @ApiPropertyOptional({ example: 80, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber(NUM)
  @Min(0, { message: 'El porcentaje de batería debe estar entre 0 y 100' })
  @Max(100, { message: 'El porcentaje de batería debe estar entre 0 y 100' })
  porcentajeBateria?: number;
}

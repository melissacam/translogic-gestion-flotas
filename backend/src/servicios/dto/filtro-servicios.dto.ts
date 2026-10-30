import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { EstadoServicio, TipoVehiculo } from '../../common/enums';
import { FORMATO_FECHA } from '../../common/utils/fecha.util';

export const CAMPOS_ORDEN = [
  'fecha',
  'codigo',
  'tarifa',
  'distanciaKm',
  'estado',
] as const;

export class FiltroServiciosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: EstadoServicio })
  @IsOptional()
  @IsEnum(EstadoServicio)
  estado?: EstadoServicio;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  clienteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  vehiculoId?: string;

  @ApiPropertyOptional({ enum: TipoVehiculo })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipoVehiculo?: TipoVehiculo;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'desde debe ser AAAA-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'hasta debe ser AAAA-MM-DD' })
  hasta?: string;

  @ApiPropertyOptional({
    example: 'SRV-2026',
    description: 'Coincidencia parcial',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;

  @ApiPropertyOptional({
    description: 'false = completados pendientes de facturar',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  facturado?: boolean;

  @ApiPropertyOptional({
    example: 'fecha:desc',
    description: `campo:asc|desc; campos: ${CAMPOS_ORDEN.join(', ')}`,
  })
  @IsOptional()
  @Matches(new RegExp(`^(${CAMPOS_ORDEN.join('|')}):(asc|desc)$`), {
    message: 'Orden inválido (ej. fecha:desc, codigo:asc, tarifa:desc)',
  })
  sort?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TipoVehiculo } from '../../common/enums';

export class RentabilidadDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000, { message: 'Año fuera de rango' })
  @Max(2100, { message: 'Año fuera de rango' })
  anio: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  mes?: number;

  @ApiPropertyOptional({ enum: TipoVehiculo })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipo?: TipoVehiculo;
}

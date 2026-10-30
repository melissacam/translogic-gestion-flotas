import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { EstadoVehiculo, TipoVehiculo } from '../../common/enums';

export class FiltroVehiculosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: TipoVehiculo })
  @IsOptional()
  @IsEnum(TipoVehiculo)
  tipo?: TipoVehiculo;

  @ApiPropertyOptional({ enum: EstadoVehiculo })
  @IsOptional()
  @IsEnum(EstadoVehiculo)
  estado?: EstadoVehiculo;

  @ApiPropertyOptional({
    example: 'GBA',
    description: 'Coincidencia parcial de placa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string;

  @ApiPropertyOptional({
    description: 'Solo vehículos que pueden recibir servicios',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  asignables?: boolean;
}

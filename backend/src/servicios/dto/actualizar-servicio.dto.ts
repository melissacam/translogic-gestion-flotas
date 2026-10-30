import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CrearServicioDto } from './crear-servicio.dto';

export class ActualizarServicioDto extends PartialType(
  OmitType(CrearServicioDto, ['codigo', 'vehiculoId'] as const),
) {
  @ApiPropertyOptional({
    example: 2,
    description: 'Versión leída (bloqueo optimista)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

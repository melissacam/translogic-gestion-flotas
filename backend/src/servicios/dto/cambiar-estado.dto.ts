import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoServicio } from '../../common/enums';

export class CambiarEstadoDto {
  @ApiProperty({ enum: EstadoServicio, example: EstadoServicio.EN_EJECUCION })
  @IsEnum(EstadoServicio, { message: 'Estado inválido' })
  estado: EstadoServicio;

  @ApiPropertyOptional({
    example: true,
    description: 'Al iniciar una furgoneta: recarga prevista',
  })
  @IsOptional()
  @IsBoolean()
  recargaPlanificada?: boolean;

  @ApiPropertyOptional({ example: 'Cliente solicitó cancelar' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  observacion?: string;
}

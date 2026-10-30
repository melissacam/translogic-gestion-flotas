import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { FORMATO_FECHA, FORMATO_HORA } from '../../common/utils/fecha.util';

export class SimularTarifaDto {
  @ApiProperty({ example: '665f1c2b9a1e4b3d8c7a5678' })
  @IsMongoId({ message: 'Vehículo inválido' })
  vehiculoId: string;

  @ApiProperty({ example: 200 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'La distancia debe ser mayor a 0 km' })
  @Max(5000)
  distanciaKm: number;

  @ApiProperty({ example: 5000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El peso no puede ser negativo' })
  pesoCargaKg: number;

  @ApiProperty({ example: '2026-11-08' })
  @Matches(FORMATO_FECHA, { message: 'Fecha inválida (AAAA-MM-DD)' })
  fecha: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(FORMATO_HORA, { message: 'Hora inválida (HH:mm)' })
  horaInicio?: string;
}

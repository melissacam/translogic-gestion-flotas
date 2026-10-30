import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { FORMATO_FECHA, FORMATO_HORA } from '../../common/utils/fecha.util';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Sin campos de tarifa: el backend la recalcula siempre (whitelist descarta lo demás)
export class CrearServicioDto {
  @ApiProperty({ example: 'SRV-2026-0101' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: 'Código inválido (3 a 20 caracteres: letras, números y guiones)',
  })
  codigo: string;

  @ApiProperty({ example: '665f1c2b9a1e4b3d8c7a1234' })
  @IsMongoId({ message: 'Cliente inválido' })
  clienteId: string;

  @ApiPropertyOptional({
    example: '665f1c2b9a1e4b3d8c7a5678',
    description: 'Opcional: asigna al crear',
  })
  @IsOptional()
  @IsMongoId({ message: 'Vehículo inválido' })
  vehiculoId?: string;

  @ApiProperty({ example: 'Guayaquil' })
  @Transform(recortar)
  @IsString()
  @Length(2, 80)
  origen: string;

  @ApiProperty({ example: 'Quito' })
  @Transform(recortar)
  @IsString()
  @Length(2, 80)
  destino: string;

  @ApiProperty({ example: 200, description: 'Mayor a 0' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La distancia debe ser un número' },
  )
  @Min(0.01, { message: 'La distancia debe ser mayor a 0 km' })
  @Max(5000)
  distanciaKm: number;

  @ApiProperty({ example: 5000, description: 'Cero o positivo' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El peso debe ser un número' })
  @Min(0, { message: 'El peso no puede ser negativo' })
  pesoCargaKg: number;

  @ApiProperty({
    example: '2026-11-03',
    description: 'AAAA-MM-DD (zona America/Guayaquil)',
  })
  @Matches(FORMATO_FECHA, { message: 'Fecha inválida (AAAA-MM-DD)' })
  fecha: string;

  @ApiProperty({ example: '08:00' })
  @Matches(FORMATO_HORA, { message: 'Hora de inicio inválida (HH:mm)' })
  horaInicio: string;

  @ApiProperty({ example: '12:00' })
  @Matches(FORMATO_HORA, { message: 'Hora de fin inválida (HH:mm)' })
  horaFinEstimada: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Furgonetas: recarga prevista en ruta',
  })
  @IsOptional()
  @IsBoolean()
  recargaPlanificada?: boolean;
}

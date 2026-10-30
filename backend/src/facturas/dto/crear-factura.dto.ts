import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsOptional,
  Matches,
} from 'class-validator';
import { FORMATO_FECHA } from '../../common/utils/fecha.util';

export class CrearFacturaDto {
  @ApiProperty({ example: '665f1c2b9a1e4b3d8c7a1234' })
  @IsMongoId({ message: 'Cliente inválido' })
  clienteId: string;

  @ApiProperty({ type: [String], example: ['665f1c2b9a1e4b3d8c7a9999'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Seleccione al menos un servicio' })
  @ArrayMaxSize(100)
  @ArrayUnique({ message: 'Hay servicios repetidos' })
  @IsMongoId({ each: true, message: 'Id de servicio inválido' })
  servicioIds: string[];

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Por defecto hoy (America/Guayaquil)',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'Fecha inválida (AAAA-MM-DD)' })
  fecha?: string;
}

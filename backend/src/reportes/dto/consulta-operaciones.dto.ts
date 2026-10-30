import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { FORMATO_FECHA, FORMATO_MES } from '../../common/utils/fecha.util';

export class ConsultaOperacionesDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    maximum: 8,
    description: 'Número de consulta avanzada',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  consulta: number;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Consultas 3, 4 y 6',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'desde debe ser AAAA-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Consultas 3, 4 y 6',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'hasta debe ser AAAA-MM-DD' })
  hasta?: string;

  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Consulta 8 (AAAA-MM)',
  })
  @IsOptional()
  @Matches(FORMATO_MES, { message: 'mes debe ser AAAA-MM' })
  mes?: string;
}

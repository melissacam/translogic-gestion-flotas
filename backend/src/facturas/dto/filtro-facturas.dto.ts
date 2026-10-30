import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, Matches } from 'class-validator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { FORMATO_MES } from '../../common/utils/fecha.util';

export class FiltroFacturasDto extends PaginacionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  clienteId?: string;

  @ApiPropertyOptional({ example: '2026-10', description: 'Periodo AAAA-MM' })
  @IsOptional()
  @Matches(FORMATO_MES, { message: 'Mes inválido (AAAA-MM)' })
  mes?: string;
}

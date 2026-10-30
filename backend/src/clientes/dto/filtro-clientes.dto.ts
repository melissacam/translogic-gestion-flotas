import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';

export class FiltroClientesDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: 'andina',
    description: 'Busca por nombre o identificación',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

export class AsignarVehiculoDto {
  @ApiProperty({ example: '665f1c2b9a1e4b3d8c7a5678' })
  @IsMongoId({ message: 'Vehículo inválido' })
  vehiculoId: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Versión del servicio que vio el usuario',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

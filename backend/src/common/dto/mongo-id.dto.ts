import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MongoIdDto {
  @ApiProperty({ example: '665f1c2b9a1e4b3d8c7a1234' })
  @IsMongoId({ message: 'El id no tiene un formato válido' })
  id: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearClienteDto {
  @ApiProperty({
    example: '0991234567001',
    description: 'Cédula (10 dígitos) o RUC (13 dígitos)',
  })
  @Transform(recortar)
  @Matches(/^(\d{10}|\d{13})$/, {
    message: 'La identificación debe ser cédula (10) o RUC (13 dígitos)',
  })
  identificacion: string;

  @ApiProperty({ example: 'Comercial Andina S.A.' })
  @Transform(recortar)
  @IsString()
  @Length(3, 120, { message: 'El nombre debe tener entre 3 y 120 caracteres' })
  nombre: string;

  @ApiProperty({ example: 'compras@andina.ec' })
  @Transform(recortar)
  @IsEmail({}, { message: 'El correo no es válido' })
  correo: string;

  @ApiProperty({ example: '0991234567' })
  @Transform(recortar)
  @Matches(/^\d{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  telefono: string;

  @ApiPropertyOptional({ example: 'Av. 9 de Octubre 100, Guayaquil' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  direccion?: string;
}

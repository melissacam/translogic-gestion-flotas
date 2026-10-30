import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@translogic.ec' })
  @IsEmail({}, { message: 'El correo no es válido' })
  email: string;

  @ApiProperty({ example: 'Admin123*' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72)
  password: string;
}

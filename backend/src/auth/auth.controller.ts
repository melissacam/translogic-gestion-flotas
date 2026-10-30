import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Publico } from '../common/decorators/publico.decorator';
import {
  UsuarioActual,
  type UsuarioJwt,
} from '../common/decorators/usuario-actual.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Límite anti fuerza bruta: 5 intentos por minuto por IP
  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({
    description: '{ accessToken, usuario { id, nombre, email, rol } }',
  })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('perfil')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Usuario de la sesión actual' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o expirado' })
  perfil(@UsuarioActual() usuario: UsuarioJwt) {
    return this.auth.perfil(usuario.id);
  }
}

import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Rol } from '../common/enums';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly servicio: UsuariosService) {}

  @Get()
  @Roles(Rol.ADMINISTRADOR)
  @ApiOkResponse({
    description: 'Usuarios del sistema (sin hash de contraseña)',
  })
  @ApiForbiddenResponse({ description: 'Solo ADMINISTRADOR' })
  listar() {
    return this.servicio.listar();
  }
}

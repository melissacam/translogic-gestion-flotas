import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import {
  UsuarioActual,
  type UsuarioJwt,
} from '../common/decorators/usuario-actual.decorator';
import { MongoIdDto } from '../common/dto/mongo-id.dto';
import { Rol } from '../common/enums';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { FiltroVehiculosDto } from './dto/filtro-vehiculos.dto';
import { VehiculosService } from './vehiculos.service';

@ApiTags('Vehículos')
@ApiBearerAuth()
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly servicio: VehiculosService) {}

  @Get()
  @ApiOkResponse({
    description: 'Lista paginada con filtros tipo, estado y placa parcial',
  })
  listar(@Query() filtro: FiltroVehiculosDto) {
    return this.servicio.listar(filtro);
  }

  @Get('placa/:placa')
  @ApiOkResponse({ description: 'Vehículo por placa exacta (normalizada)' })
  @ApiNotFoundResponse({ description: 'No existe' })
  porPlaca(@Param('placa') placa: string) {
    return this.servicio.obtenerPorPlaca(placa);
  }

  @Get(':id/eficiencia')
  @ApiOkResponse({
    description:
      'Eficiencia km/USD, costo por km y comparación con su categoría',
  })
  eficiencia(@Param() { id }: MongoIdDto) {
    return this.servicio.eficiencia(id);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Vehículo (incluye autonomía disponible si es furgoneta)',
  })
  @ApiNotFoundResponse({ description: 'No existe' })
  obtener(@Param() { id }: MongoIdDto) {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(Rol.ADMINISTRADOR)
  @ApiCreatedResponse({ description: 'Vehículo creado' })
  @ApiBadRequestResponse({ description: 'Datos inválidos para el tipo' })
  @ApiConflictResponse({ description: 'Placa duplicada' })
  @ApiForbiddenResponse({ description: 'Solo ADMINISTRADOR' })
  crear(@Body() dto: CrearVehiculoDto) {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Vehículo actualizado' })
  @ApiForbiddenResponse({
    description: 'OPERADOR solo edita kilometraje, batería y estado',
  })
  actualizar(
    @Param() { id }: MongoIdDto,
    @Body() dto: ActualizarVehiculoDto,
    @UsuarioActual() usuario: UsuarioJwt,
  ) {
    return this.servicio.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @Roles(Rol.ADMINISTRADOR)
  @ApiOkResponse({
    description: 'Vehículo desactivado (borrado lógico a INACTIVO)',
  })
  @ApiConflictResponse({ description: 'Tiene servicios activos' })
  desactivar(@Param() { id }: MongoIdDto) {
    return this.servicio.desactivar(id);
  }
}

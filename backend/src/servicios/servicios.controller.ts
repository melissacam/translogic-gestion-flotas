import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  UsuarioActual,
  type UsuarioJwt,
} from '../common/decorators/usuario-actual.decorator';
import { MongoIdDto } from '../common/dto/mongo-id.dto';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto';
import { AsignarVehiculoDto } from './dto/asignar-vehiculo.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { CrearServicioDto } from './dto/crear-servicio.dto';
import { FiltroServiciosDto } from './dto/filtro-servicios.dto';
import { SimularTarifaDto } from './dto/simular-tarifa.dto';
import { ServiciosService } from './servicios.service';

@ApiTags('Servicios de transporte')
@ApiBearerAuth()
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly servicio: ServiciosService) {}

  @Get()
  @ApiOkResponse({
    description:
      '{ data, total, page, limit, totalPages } con filtros combinables',
  })
  listar(@Query() filtro: FiltroServiciosDto) {
    return this.servicio.listar(filtro);
  }

  @Post('simular-tarifa')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Desglose de tarifa sin persistir (incluye recargos informativos)',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Carga mayor a la capacidad u otros datos inválidos',
  })
  simular(@Body() dto: SimularTarifaDto) {
    return this.servicio.simularTarifa(dto);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Servicio con cliente, vehículo y desglose de cálculo',
  })
  @ApiNotFoundResponse({ description: 'No existe' })
  obtener(@Param() { id }: MongoIdDto) {
    return this.servicio.obtener(id);
  }

  @Get(':id/historial')
  @ApiOkResponse({
    description: 'Historial de estados con el nombre del usuario',
  })
  historial(@Param() { id }: MongoIdDto) {
    return this.servicio.historialDe(id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Servicio creado en PROGRAMADO' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos (p. ej. distancia ≤ 0)',
  })
  @ApiConflictResponse({
    description: 'Código duplicado o vehículo ocupado en ese horario',
  })
  crear(@Body() dto: CrearServicioDto, @UsuarioActual() usuario: UsuarioJwt) {
    return this.servicio.crear(dto, usuario);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Servicio actualizado y tarifa recalculada' })
  @ApiConflictResponse({
    description: 'No está PROGRAMADO, versión desactualizada o solapamiento',
  })
  actualizar(@Param() { id }: MongoIdDto, @Body() dto: ActualizarServicioDto) {
    return this.servicio.actualizar(id, dto);
  }

  @Patch(':id/asignacion')
  @ApiOkResponse({ description: 'Vehículo asignado y tarifa calculada' })
  @ApiConflictResponse({
    description: 'Otro servicio usa el vehículo en ese horario',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Capacidad excedida o vehículo no disponible',
  })
  asignar(@Param() { id }: MongoIdDto, @Body() dto: AsignarVehiculoDto) {
    return this.servicio.asignar(id, dto);
  }

  @Patch(':id/estado')
  @ApiOkResponse({
    description: 'Estado cambiado y registrado en el historial',
  })
  @ApiConflictResponse({
    description: 'Transición no permitida por la máquina de estados',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Sin vehículo o energía insuficiente',
  })
  cambiarEstado(
    @Param() { id }: MongoIdDto,
    @Body() dto: CambiarEstadoDto,
    @UsuarioActual() usuario: UsuarioJwt,
  ) {
    return this.servicio.cambiarEstado(id, dto, usuario);
  }
}

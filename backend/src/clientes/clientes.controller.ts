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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { MongoIdDto } from '../common/dto/mongo-id.dto';
import { Rol } from '../common/enums';
import { ClientesService } from './clientes.service';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { FiltroClientesDto } from './dto/filtro-clientes.dto';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly servicio: ClientesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Lista paginada { data, total, page, limit, totalPages }',
  })
  listar(@Query() filtro: FiltroClientesDto) {
    return this.servicio.listar(filtro);
  }

  @Get(':id')
  @Roles(Rol.ADMINISTRADOR)
  @ApiOkResponse({ description: 'Cliente' })
  @ApiNotFoundResponse({ description: 'No existe' })
  obtener(@Param() { id }: MongoIdDto) {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Cliente creado' })
  @ApiConflictResponse({ description: 'Identificación duplicada' })
  crear(@Body() dto: CrearClienteDto) {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR)
  @ApiOkResponse({ description: 'Cliente actualizado' })
  @ApiForbiddenResponse({ description: 'Solo ADMINISTRADOR' })
  actualizar(@Param() { id }: MongoIdDto, @Body() dto: ActualizarClienteDto) {
    return this.servicio.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(Rol.ADMINISTRADOR)
  @ApiOkResponse({ description: 'Cliente eliminado' })
  @ApiConflictResponse({ description: 'Tiene servicios registrados' })
  eliminar(@Param() { id }: MongoIdDto) {
    return this.servicio.eliminar(id);
  }
}

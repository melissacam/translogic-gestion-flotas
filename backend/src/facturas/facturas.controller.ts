import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import {
  UsuarioActual,
  type UsuarioJwt,
} from '../common/decorators/usuario-actual.decorator';
import { MongoIdDto } from '../common/dto/mongo-id.dto';
import { Rol } from '../common/enums';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { FiltroFacturasDto } from './dto/filtro-facturas.dto';
import { FacturasService } from './facturas.service';

// Facturación exclusiva del ADMINISTRADOR (OPERADOR → 403)
@ApiTags('Facturas')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Solo ADMINISTRADOR' })
@Roles(Rol.ADMINISTRADOR)
@Controller('facturas')
export class FacturasController {
  constructor(private readonly servicio: FacturasService) {}

  @Post('simular')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Desglose de la factura sin guardar' })
  @ApiUnprocessableEntityResponse({
    description: 'Servicios no completados o de otro cliente',
  })
  simular(@Body() dto: CrearFacturaDto) {
    return this.servicio.simular(dto);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Factura emitida en una sola transacción',
  })
  @ApiConflictResponse({ description: 'Algún servicio ya fue facturado' })
  @ApiUnprocessableEntityResponse({
    description: 'Servicios inválidos; no se guarda nada',
  })
  crear(@Body() dto: CrearFacturaDto, @UsuarioActual() usuario: UsuarioJwt) {
    return this.servicio.crear(dto, usuario);
  }

  @Get()
  @ApiOkResponse({
    description: 'Facturas paginadas, filtro por cliente y mes',
  })
  listar(@Query() filtro: FiltroFacturasDto) {
    return this.servicio.listar(filtro);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Factura con cliente y detalles' })
  obtener(@Param() { id }: MongoIdDto) {
    return this.servicio.obtener(id);
  }

  @Get(':id/pdf')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Comprobante simulado en PDF' })
  async pdf(@Param() { id }: MongoIdDto) {
    const { codigo, buffer } = await this.servicio.generarPdf(id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${codigo}.pdf"`,
    });
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Rol } from '../common/enums';
import { ConsultaOperacionesDto } from './dto/consulta-operaciones.dto';
import { RentabilidadDto } from './dto/rentabilidad.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Solo ADMINISTRADOR' })
@Roles(Rol.ADMINISTRADOR)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly servicio: ReportesService) {}

  @Get('operaciones')
  @ApiOkResponse({ description: 'Resultado de la consulta avanzada N (1 a 8)' })
  operaciones(@Query() dto: ConsultaOperacionesDto) {
    return this.servicio.operaciones(dto);
  }

  @Get('rentabilidad')
  @ApiOkResponse({
    description:
      'kpis, serviciosPorEstado, distribucionPorTipo, comparacionMensual y porVehiculo',
  })
  rentabilidad(@Query() dto: RentabilidadDto) {
    return this.servicio.rentabilidad(dto);
  }
}

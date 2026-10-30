import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { paginado } from '../common/dto/paginacion.dto';
import { UsuarioJwt } from '../common/decorators/usuario-actual.decorator';
import { EstadoVehiculo, Rol, TipoVehiculo } from '../common/enums';
import { aDecimal128 } from '../common/utils/decimal.util';
import { TarifasService } from '../tarifas/tarifas.service';
import {
  ActualizarVehiculoDto,
  CAMPOS_OPERADOR,
} from './dto/actualizar-vehiculo.dto';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { FiltroVehiculosDto } from './dto/filtro-vehiculos.dto';
import { VehiculoLean } from './schemas/vehiculo.schema';
import { VehiculosRepository } from './vehiculos.repository';

const CAMPOS_COMUNES = [
  'placa',
  'marca',
  'modelo',
  'anio',
  'capacidadCargaKg',
  'kilometraje',
];
const CAMPOS_POR_TIPO: Record<TipoVehiculo, string[]> = {
  [TipoVehiculo.CAMION_CARGA]: [
    'consumoLitros100Km',
    'precioLitro',
    'numeroEjes',
    'costoMantenimientoKm',
  ],
  [TipoVehiculo.FURGONETA_ELECTRICA]: [
    'capacidadBateriaKWh',
    'consumoKWh100Km',
    'costoKWh',
    'autonomiaKm',
    'porcentajeBateria',
  ],
};
const CAMPOS_DINERO = new Set([
  'precioLitro',
  'costoMantenimientoKm',
  'costoKWh',
]);

@Injectable()
export class VehiculosService {
  constructor(
    private readonly repo: VehiculosRepository,
    private readonly tarifas: TarifasService,
  ) {}

  async listar(filtro: FiltroVehiculosDto) {
    const { data, total } = await this.repo.listar(
      filtro,
      filtro.page,
      filtro.limit,
    );
    return paginado(
      data.map((v) => this.conAutonomia(v)),
      total,
      filtro.page,
      filtro.limit,
    );
  }

  async obtener(id: string) {
    const vehiculo = await this.repo.buscarPorId(id);
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    return this.conAutonomia(vehiculo);
  }

  async obtenerPorPlaca(placa: string) {
    const vehiculo = await this.repo.buscarPorPlaca(placa);
    if (!vehiculo)
      throw new NotFoundException(`No existe un vehículo con placa ${placa}`);
    return this.conAutonomia(vehiculo);
  }

  async crear(dto: CrearVehiculoDto) {
    const datos = this.extraerCampos(
      dto as unknown as Record<string, unknown>,
      dto.tipo,
    );
    // Placa única entre ambos tipos: índice único en la colección compartida (E11000 → 409)
    const creado = await this.repo.crear(dto.tipo, {
      ...datos,
      tipo: dto.tipo,
      kilometraje: dto.kilometraje ?? 0,
      estado: EstadoVehiculo.DISPONIBLE,
      version: 0,
    });
    return this.obtener(creado._id.toString());
  }

  async actualizar(
    id: string,
    dto: ActualizarVehiculoDto,
    usuario: UsuarioJwt,
  ) {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new NotFoundException('Vehículo no encontrado');
    const cambios = dto as Record<string, unknown>;
    const claves = Object.keys(cambios).filter((k) => cambios[k] !== undefined);

    // Matriz de permisos: el OPERADOR solo edita kilometraje, batería y estado
    if (
      usuario.rol === Rol.OPERADOR &&
      claves.some((k) => !CAMPOS_OPERADOR.has(k))
    ) {
      throw new ForbiddenException(
        'El operador solo puede editar kilometraje, batería y estado',
      );
    }
    const ajenos = claves.filter(
      (k) =>
        k !== 'estado' &&
        !CAMPOS_COMUNES.includes(k) &&
        !CAMPOS_POR_TIPO[actual.tipo].includes(k),
    );
    if (ajenos.length > 0) {
      throw new BadRequestException(
        `Campos no válidos para ${actual.tipo}: ${ajenos.join(', ')}`,
      );
    }
    if (dto.kilometraje !== undefined && dto.kilometraje < actual.kilometraje) {
      throw new UnprocessableEntityException(
        'El kilometraje no puede disminuir',
      );
    }
    if (dto.estado) this.validarCambioEstado(actual, dto.estado);

    const set = this.extraerCampos(cambios, actual.tipo);
    if (dto.estado) set.estado = dto.estado;
    const actualizado = await this.repo.actualizar(id, actual.tipo, set);
    return this.conAutonomia(actualizado!);
  }

  // Borrado lógico (INACTIVO) para conservar la trazabilidad histórica
  async desactivar(id: string) {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new NotFoundException('Vehículo no encontrado');
    if (await this.repo.tieneServiciosActivos(id)) {
      throw new ConflictException(
        'El vehículo tiene servicios programados o en ejecución',
      );
    }
    await this.repo.cambiarEstado(id, EstadoVehiculo.INACTIVO);
    return this.obtener(id);
  }

  async eficiencia(id: string) {
    const vehiculo = await this.obtener(id);
    const { propio, categorias } = await this.repo.eficiencia(id);
    const promedio =
      categorias.find((c) => c._id === vehiculo.tipo)?.promedio ?? null;
    const base = propio[0] ?? {
      serviciosCompletados: 0,
      kmRecorridos: 0,
      costoOperativoTotal: aDecimal128(0),
      ingresosTotales: aDecimal128(0),
      eficienciaKmPorUsd: aDecimal128(0),
      costoPorKm: aDecimal128(0),
      clasificacion: 'BAJO_PROMEDIO',
    };
    return {
      vehiculoId: id,
      placa: vehiculo.placa,
      tipo: vehiculo.tipo,
      ...base,
      promedioCategoria: promedio ?? aDecimal128(0),
      autonomiaDisponibleKm: vehiculo.autonomiaDisponibleKm,
    };
  }

  private validarCambioEstado(
    actual: VehiculoLean,
    nuevo: EstadoVehiculo,
  ): void {
    // EN_SERVICIO lo controla la máquina de estados del servicio, no la edición manual
    if (
      actual.estado === EstadoVehiculo.EN_SERVICIO &&
      nuevo !== actual.estado
    ) {
      throw new ConflictException(
        'El vehículo está en servicio; su estado lo controla el servicio',
      );
    }
  }

  private extraerCampos(origen: Record<string, unknown>, tipo: TipoVehiculo) {
    const salida: Record<string, unknown> = {};
    for (const campo of [...CAMPOS_COMUNES, ...CAMPOS_POR_TIPO[tipo]]) {
      const valor = origen[campo];
      if (valor === undefined) continue;
      // Precios unitarios como Decimal128, nunca number
      salida[campo] = CAMPOS_DINERO.has(campo)
        ? aDecimal128(valor as number)
        : valor;
    }
    return salida;
  }

  private conAutonomia(v: VehiculoLean) {
    if (v.tipo !== TipoVehiculo.FURGONETA_ELECTRICA)
      return { ...v, autonomiaDisponibleKm: undefined };
    return {
      ...v,
      autonomiaDisponibleKm: this.tarifas.autonomiaDisponible(v).toFixed(2),
    };
  }
}

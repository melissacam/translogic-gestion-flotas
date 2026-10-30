import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientSession, Types } from 'mongoose';
import { ClientesRepository } from '../clientes/clientes.repository';
import { UsuarioJwt } from '../common/decorators/usuario-actual.decorator';
import { paginado } from '../common/dto/paginacion.dto';
import { EstadoServicio, EstadoVehiculo, TipoVehiculo } from '../common/enums';
import { aDecimal128, dinero128 } from '../common/utils/decimal.util';
import {
  combinarFechaHora,
  finDelDia,
  inicioDelDia,
} from '../common/utils/fecha.util';
import { TransaccionService } from '../database/transaccion.service';
import { HistorialService } from '../historial/historial.service';
import { CalculoCompleto, TarifasService } from '../tarifas/tarifas.service';
import { VehiculoLean } from '../vehiculos/schemas/vehiculo.schema';
import { VehiculosRepository } from '../vehiculos/vehiculos.repository';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto';
import { AsignarVehiculoDto } from './dto/asignar-vehiculo.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { CrearServicioDto } from './dto/crear-servicio.dto';
import { FiltroServiciosDto } from './dto/filtro-servicios.dto';
import { SimularTarifaDto } from './dto/simular-tarifa.dto';
import { validarTransicion } from './estado.maquina';
import { ServicioLean, ServiciosRepository } from './servicios.repository';

const ESTADOS_VEHICULO_NO_ASIGNABLES = [
  EstadoVehiculo.MANTENIMIENTO,
  EstadoVehiculo.INACTIVO,
];

type AccionTransicion = (
  s: ServicioLean,
  dto: CambiarEstadoDto,
  session: ClientSession,
) => Promise<void>;

@Injectable()
export class ServiciosService {
  // Efectos de cada estado destino; las transiciones válidas las decide estado.maquina.ts
  private readonly acciones: Record<EstadoServicio, AccionTransicion> = {
    [EstadoServicio.PROGRAMADO]: async () => undefined,
    [EstadoServicio.EN_EJECUCION]: (s, dto, session) =>
      this.iniciar(s, dto, session),
    [EstadoServicio.COMPLETADO]: (s, _dto, session) =>
      this.completar(s, session),
    [EstadoServicio.CANCELADO]: (s, _dto, session) => this.cancelar(s, session),
  };

  constructor(
    private readonly repo: ServiciosRepository,
    private readonly vehiculos: VehiculosRepository,
    private readonly clientes: ClientesRepository,
    private readonly tarifas: TarifasService,
    private readonly historial: HistorialService,
    private readonly tx: TransaccionService,
    private readonly config: ConfigService,
  ) {}

  private get zona(): string {
    return this.config.getOrThrow<string>('ZONA_HORARIA');
  }

  async listar(f: FiltroServiciosDto) {
    const [campo, dir] = (f.sort ?? 'fecha:desc').split(':');
    const { data, total } = await this.repo.listar(
      {
        ...f,
        desde: f.desde ? inicioDelDia(f.desde, this.zona) : undefined,
        hasta: f.hasta ? finDelDia(f.hasta, this.zona) : undefined,
      },
      { [campo]: dir === 'asc' ? 1 : -1 },
      f.page,
      f.limit,
    );
    return paginado(data, total, f.page, f.limit);
  }

  async obtener(id: string) {
    const servicio = await this.repo.detalle(id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return servicio;
  }

  historialDe(id: string) {
    return this.historial.listarPorServicio(id);
  }

  async crear(dto: CrearServicioDto, usuario: UsuarioJwt) {
    const horario = this.calcularHorario(
      dto.fecha,
      dto.horaInicio,
      dto.horaFinEstimada,
    );
    const id = await this.tx.ejecutar(async (session) => {
      const cliente = await this.clientes.buscarPorId(dto.clienteId, session);
      if (!cliente)
        throw new UnprocessableEntityException('El cliente no existe');
      // Código único: índice único en servicios.codigo (E11000 → 409, rollback)
      const creado = await this.repo.crear(
        {
          codigo: dto.codigo,
          clienteId: cliente._id,
          vehiculoId: null,
          origen: dto.origen,
          destino: dto.destino,
          distanciaKm: dto.distanciaKm,
          pesoCargaKg: dto.pesoCargaKg,
          ...horario,
          horaInicio: dto.horaInicio,
          horaFinEstimada: dto.horaFinEstimada,
          estado: EstadoServicio.PROGRAMADO,
          recargaPlanificada: dto.recargaPlanificada ?? false,
          kilometrajeAplicado: false,
          facturaId: null,
          version: 0,
          creadoPor: new Types.ObjectId(usuario.id),
        },
        session,
      );
      await this.historial.registrar(
        creado._id,
        null,
        EstadoServicio.PROGRAMADO,
        usuario.id,
        session,
      );
      if (dto.vehiculoId)
        await this.asignarEnSesion(creado, dto.vehiculoId, session);
      return creado._id;
    });
    return this.obtener(id.toString());
  }

  async actualizar(id: string, dto: ActualizarServicioDto) {
    await this.tx.ejecutar(async (session) => {
      const actual = await this.cargarProgramado(
        id,
        dto.version,
        session,
        'editar',
      );
      if (
        dto.clienteId &&
        !(await this.clientes.buscarPorId(dto.clienteId, session))
      ) {
        throw new UnprocessableEntityException('El cliente no existe');
      }
      const fecha = dto.fecha ?? this.fechaTexto(actual);
      const horaInicio = dto.horaInicio ?? actual.horaInicio;
      const horaFin = dto.horaFinEstimada ?? actual.horaFinEstimada;
      const nuevo: ServicioLean = {
        ...actual,
        ...(dto.origen !== undefined && { origen: dto.origen }),
        ...(dto.destino !== undefined && { destino: dto.destino }),
        ...(dto.distanciaKm !== undefined && { distanciaKm: dto.distanciaKm }),
        ...(dto.pesoCargaKg !== undefined && { pesoCargaKg: dto.pesoCargaKg }),
        ...(dto.recargaPlanificada !== undefined && {
          recargaPlanificada: dto.recargaPlanificada,
        }),
        ...(dto.clienteId && { clienteId: new Types.ObjectId(dto.clienteId) }),
        ...this.calcularHorario(fecha, horaInicio, horaFin),
        horaInicio,
        horaFinEstimada: horaFin,
      };
      // Al editar se recalcula la tarifa y se revalida el solapamiento con el vehículo
      if (nuevo.vehiculoId) {
        await this.asignarEnSesion(nuevo, nuevo.vehiculoId.toString(), session);
        return;
      }
      await this.guardarCondicional(
        actual,
        this.camposEditables(nuevo),
        session,
      );
    });
    return this.obtener(id);
  }

  // Asignación (Req-03.7 / 03.11): una sola transacción por petición concurrente
  async asignar(id: string, dto: AsignarVehiculoDto) {
    await this.tx.ejecutar(async (session) => {
      const servicio = await this.cargarProgramado(
        id,
        dto.version,
        session,
        'asignar',
      );
      await this.asignarEnSesion(servicio, dto.vehiculoId, session);
    });
    return this.obtener(id);
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto, usuario: UsuarioJwt) {
    await this.tx.ejecutar(async (session) => {
      const servicio = await this.repo.buscarPorId(id, session);
      if (!servicio) throw new NotFoundException('Servicio no encontrado');
      validarTransicion(servicio.estado, dto.estado);
      await this.acciones[dto.estado](servicio, dto, session);
      // Auditoría en la misma transacción: si el cambio se revierte, el historial también
      await this.historial.registrar(
        servicio._id,
        servicio.estado,
        dto.estado,
        usuario.id,
        session,
        dto.observacion,
      );
    });
    return this.obtener(id);
  }

  // Previsualización: calcula el desglose sin escribir nada en la base
  async simularTarifa(dto: SimularTarifaDto) {
    const vehiculo = await this.vehiculos.buscarPorId(dto.vehiculoId);
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    const inicio = combinarFechaHora(
      dto.fecha,
      dto.horaInicio ?? '08:00',
      this.zona,
    );
    const calculo = this.tarifas.calcularCompleto(
      vehiculo,
      dto.distanciaKm,
      dto.pesoCargaKg,
      inicio,
    );
    const advertencias: string[] = [];
    const autonomia = calculo.tarifa.autonomiaDisponibleKm;
    if (autonomia && autonomia.lt(dto.distanciaKm)) {
      advertencias.push(
        `Energía insuficiente: autonomía disponible ${autonomia.toFixed(2)} km para ${dto.distanciaKm} km. Requiere recarga planificada.`,
      );
    }
    return {
      vehiculo: {
        id: vehiculo._id,
        placa: vehiculo.placa,
        tipo: vehiculo.tipo,
      },
      ...this.instantanea(calculo),
      advertencias,
    };
  }

  private async cargarProgramado(
    id: string,
    version: number | undefined,
    session: ClientSession,
    accion: string,
  ): Promise<ServicioLean> {
    const servicio = await this.repo.buscarPorId(id, session);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    if (servicio.estado !== EstadoServicio.PROGRAMADO) {
      throw new ConflictException(
        `Solo se puede ${accion} un servicio PROGRAMADO (actual: ${servicio.estado})`,
      );
    }
    // Bloqueo optimista: el cliente trabajó sobre una versión desactualizada
    if (version !== undefined && version !== servicio.version) {
      throw new ConflictException(
        'El servicio fue modificado por otro usuario. Actualiza la vista.',
      );
    }
    return servicio;
  }

  private async asignarEnSesion(
    servicio: ServicioLean,
    vehiculoId: string,
    session: ClientSession,
  ): Promise<void> {
    // 1) Toque del vehículo: dos asignaciones simultáneas chocan aquí (WriteConflict + reintento)
    const vehiculo = await this.vehiculos.tocar(vehiculoId, session);
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    if (ESTADOS_VEHICULO_NO_ASIGNABLES.includes(vehiculo.estado)) {
      throw new UnprocessableEntityException(
        `El vehículo está en ${vehiculo.estado} y no puede asignarse`,
      );
    }
    // 2) Solapamiento de horarios dentro de la misma transacción (lectura consistente)
    const choque = await this.repo.buscarSolapado(
      vehiculo._id,
      servicio.inicio,
      servicio.finEstimada,
      servicio._id,
      session,
    );
    if (choque) {
      throw new ConflictException(
        `El vehículo ${vehiculo.placa} ya está asignado al servicio ${choque.codigo} en ese horario`,
      );
    }
    // 3) Capacidad y tarifa con la estrategia del tipo; el backend siempre recalcula
    const calculo = this.tarifas.calcularCompleto(
      vehiculo,
      servicio.distanciaKm,
      servicio.pesoCargaKg,
      servicio.inicio,
    );
    // 4) Escritura condicionada a estado PROGRAMADO y a la versión leída
    await this.guardarCondicional(
      servicio,
      {
        ...this.camposEditables(servicio),
        vehiculoId: vehiculo._id,
        ...this.importes(calculo, vehiculo),
      },
      session,
    );
  }

  private async guardarCondicional(
    leido: ServicioLean,
    set: Record<string, unknown>,
    session: ClientSession,
  ): Promise<void> {
    const ok = await this.repo.actualizarSiCoincide(
      {
        _id: leido._id,
        estado: EstadoServicio.PROGRAMADO,
        version: leido.version,
      },
      set,
      session,
    );
    if (!ok) {
      throw new ConflictException(
        'El servicio fue modificado por otra operación. Actualiza la vista.',
      );
    }
  }

  private async iniciar(
    s: ServicioLean,
    dto: CambiarEstadoDto,
    session: ClientSession,
  ) {
    if (!s.vehiculoId) {
      throw new UnprocessableEntityException(
        'Asigna un vehículo antes de iniciar el servicio',
      );
    }
    const vehiculo = await this.vehiculos.tocar(s.vehiculoId, session);
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    if (ESTADOS_VEHICULO_NO_ASIGNABLES.includes(vehiculo.estado)) {
      throw new UnprocessableEntityException(
        `El vehículo está en ${vehiculo.estado}`,
      );
    }
    const otro = await this.repo.buscarOtroEnEjecucion(
      vehiculo._id,
      s._id,
      session,
    );
    if (otro) {
      throw new ConflictException(
        `El vehículo está ejecutando el servicio ${otro.codigo}`,
      );
    }
    const recarga = dto.recargaPlanificada ?? s.recargaPlanificada;
    // Furgoneta: sin autonomía suficiente solo inicia si hay recarga planificada
    if (vehiculo.tipo === TipoVehiculo.FURGONETA_ELECTRICA && !recarga) {
      const autonomia = this.tarifas.autonomiaDisponible(vehiculo);
      if (autonomia.lt(s.distanciaKm)) {
        throw new UnprocessableEntityException(
          `Energía insuficiente: autonomía disponible ${autonomia.toFixed(2)} km para una ruta de ${s.distanciaKm} km. Planifica una recarga.`,
        );
      }
    }
    const ok = await this.repo.actualizarSiCoincide(
      { _id: s._id, estado: EstadoServicio.PROGRAMADO, version: s.version },
      { estado: EstadoServicio.EN_EJECUCION, recargaPlanificada: recarga },
      session,
    );
    if (!ok)
      throw new ConflictException(
        'El servicio cambió de estado en otra operación',
      );
    await this.vehiculos.cambiarEstado(
      vehiculo._id,
      EstadoVehiculo.EN_SERVICIO,
      session,
    );
  }

  private async completar(s: ServicioLean, session: ClientSession) {
    // Update condicional: solo una petición pasa de EN_EJECUCION a COMPLETADO
    const ok = await this.repo.actualizarSiCoincide(
      {
        _id: s._id,
        estado: EstadoServicio.EN_EJECUCION,
        kilometrajeAplicado: false,
      },
      {
        estado: EstadoServicio.COMPLETADO,
        kilometrajeAplicado: true,
        completadoEn: new Date(),
      },
      session,
    );
    if (!ok) throw new ConflictException('El servicio ya fue completado');
    // Kilometraje sumado exactamente una vez (solo si el update anterior modificó 1 documento)
    await this.vehiculos.sumarKilometraje(
      s.vehiculoId!,
      s.distanciaKm,
      session,
    );
  }

  private async cancelar(s: ServicioLean, session: ClientSession) {
    const ok = await this.repo.actualizarSiCoincide(
      { _id: s._id, estado: s.estado, version: s.version },
      { estado: EstadoServicio.CANCELADO },
      session,
    );
    if (!ok)
      throw new ConflictException(
        'El servicio cambió de estado en otra operación',
      );
    if (s.estado === EstadoServicio.EN_EJECUCION && s.vehiculoId) {
      await this.vehiculos.cambiarEstado(
        s.vehiculoId,
        EstadoVehiculo.DISPONIBLE,
        session,
      );
    }
  }

  private calcularHorario(fecha: string, horaInicio: string, horaFin: string) {
    const inicio = combinarFechaHora(fecha, horaInicio, this.zona);
    const finEstimada = combinarFechaHora(fecha, horaFin, this.zona);
    if (finEstimada <= inicio) {
      throw new UnprocessableEntityException(
        'La hora de fin estimada debe ser posterior a la de inicio',
      );
    }
    return { fecha: inicioDelDia(fecha, this.zona), inicio, finEstimada };
  }

  private fechaTexto(s: ServicioLean): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.zona }).format(
      s.inicio,
    );
  }

  private camposEditables(s: ServicioLean) {
    return {
      clienteId: s.clienteId,
      origen: s.origen,
      destino: s.destino,
      distanciaKm: s.distanciaKm,
      pesoCargaKg: s.pesoCargaKg,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFinEstimada: s.horaFinEstimada,
      inicio: s.inicio,
      finEstimada: s.finEstimada,
      recargaPlanificada: s.recargaPlanificada,
    };
  }

  // Importes como Decimal128 redondeados + instantánea del cálculo para auditoría
  importes(calculo: CalculoCompleto, vehiculo: VehiculoLean) {
    return {
      costoOperativo: dinero128(calculo.tarifa.costoOperativo),
      tarifa: dinero128(calculo.tarifa.tarifa),
      recargos: dinero128(calculo.recargo.recargo),
      importe: dinero128(calculo.importe),
      detalleCalculo: {
        ...this.instantanea(calculo),
        parametrosVehiculo: {
          placa: vehiculo.placa,
          capacidadCargaKg: vehiculo.capacidadCargaKg,
          consumoLitros100Km: vehiculo.consumoLitros100Km,
          precioLitro: vehiculo.precioLitro,
          costoMantenimientoKm: vehiculo.costoMantenimientoKm,
          consumoKWh100Km: vehiculo.consumoKWh100Km,
          costoKWh: vehiculo.costoKWh,
          autonomiaKm: vehiculo.autonomiaKm,
          porcentajeBateria: vehiculo.porcentajeBateria,
        },
        calculadoEn: new Date(),
      },
    };
  }

  private instantanea(c: CalculoCompleto) {
    const t = c.tarifa;
    return {
      tipo: t.tipo,
      costoCombustible: t.costoCombustible
        ? dinero128(t.costoCombustible)
        : null,
      costoEnergetico: t.costoEnergetico ? dinero128(t.costoEnergetico) : null,
      costoMantenimiento: dinero128(t.costoMantenimiento),
      costoOperativo: dinero128(t.costoOperativo),
      tarifaBase: dinero128(t.tarifaBase),
      ajustePorcentaje: Number(t.ajustePorcentaje),
      motivoAjuste: t.motivoAjuste,
      tarifa: dinero128(t.tarifa),
      autonomiaDisponibleKm: t.autonomiaDisponibleKm
        ? aDecimal128(t.autonomiaDisponibleKm)
        : null,
      recargoPorcentaje: Number(c.recargo.porcentaje),
      motivosRecargo: c.recargo.motivos,
      recargos: dinero128(c.recargo.recargo),
      importe: dinero128(c.importe),
    };
  }
}

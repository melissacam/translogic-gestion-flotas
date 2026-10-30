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
import { EstadoServicio } from '../common/enums';
import { dec, dinero128 } from '../common/utils/decimal.util';
import {
  inicioDelDia,
  periodoDe,
  rangoDelMes,
} from '../common/utils/fecha.util';
import { ContadoresRepository } from '../database/contadores.repository';
import { TransaccionService } from '../database/transaccion.service';
import { ServiciosRepository } from '../servicios/servicios.repository';
import { calcularFactura, ResultadoFactura } from './calculo-factura';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { FiltroFacturasDto } from './dto/filtro-facturas.dto';
import { FacturasRepository } from './facturas.repository';
import { PdfFacturaService } from './pdf-factura.service';

@Injectable()
export class FacturasService {
  constructor(
    private readonly repo: FacturasRepository,
    private readonly servicios: ServiciosRepository,
    private readonly clientes: ClientesRepository,
    private readonly contadores: ContadoresRepository,
    private readonly tx: TransaccionService,
    private readonly config: ConfigService,
    private readonly pdf: PdfFacturaService,
  ) {}

  private get zona(): string {
    return this.config.getOrThrow<string>('ZONA_HORARIA');
  }

  private get tasaIva(): string {
    return String(this.config.getOrThrow<number>('IVA_TASA'));
  }

  // Previsualización: mismas validaciones y cálculo que al emitir, sin escribir nada
  async simular(dto: CrearFacturaDto) {
    const fecha = this.fechaFactura(dto.fecha);
    const calculo = await this.validarYCalcular(dto, fecha);
    return {
      fecha,
      periodo: periodoDe(fecha, this.zona),
      ...this.presentar(calculo),
    };
  }

  async crear(dto: CrearFacturaDto, usuario?: UsuarioJwt) {
    const fecha = this.fechaFactura(dto.fecha);
    const periodo = periodoDe(fecha, this.zona);
    // Transacción: si algo falla no queda factura parcial (rollback automático)
    const facturaId = await this.tx.ejecutar(async (session) => {
      const calculo = await this.validarYCalcular(dto, fecha, session);

      // Código correlativo por mes con $inc atómico dentro de la misma sesión
      const secuencia = await this.contadores.siguiente(
        `FAC-${periodo.replace('-', '')}`,
        session,
      );
      const codigo = `FAC-${periodo.replace('-', '')}-${String(secuencia).padStart(4, '0')}`;

      const factura = await this.repo.crear(
        {
          codigo,
          clienteId: new Types.ObjectId(dto.clienteId),
          fecha,
          periodo,
          subtotal: dinero128(calculo.subtotal),
          recargos: dinero128(calculo.recargos),
          base: dinero128(calculo.base),
          serviciosCompletadosMes: calculo.serviciosCompletadosMes,
          porcentajeDescuento: calculo.porcentajeDescuento.toNumber(),
          descuento: dinero128(calculo.descuento),
          baseImponible: dinero128(calculo.baseImponible),
          tasaImpuesto: calculo.tasaImpuesto.toNumber(),
          impuesto: dinero128(calculo.impuesto),
          total: dinero128(calculo.total),
          cantidadServicios: calculo.lineas.length,
          emitidaPor: usuario ? new Types.ObjectId(usuario.id) : undefined,
        },
        session,
      );

      // Update condicional: solo servicios COMPLETADO y aún sin factura
      const ids = dto.servicioIds.map((id) => new Types.ObjectId(id));
      const marcados = await this.servicios.marcarFacturados(
        ids,
        factura._id,
        session,
      );
      if (marcados !== ids.length) {
        throw new ConflictException(
          'Otra factura tomó alguno de los servicios. No se emitió la factura.',
        );
      }

      await this.repo.insertarDetalles(
        calculo.lineas.map((l) => ({
          facturaId: factura._id,
          servicioId: new Types.ObjectId(l.servicioId),
          codigoServicio: l.codigo,
          tarifa: dinero128(l.tarifa),
          porcentajeRecargo: l.porcentajeRecargo.toNumber(),
          recargos: dinero128(l.recargo),
          importe: dinero128(l.importe),
        })),
        session,
      );
      return factura._id;
    });
    return this.obtener(facturaId.toString());
  }

  async listar(f: FiltroFacturasDto) {
    const { data, total } = await this.repo.listar(f, f.page, f.limit);
    return paginado(data, total, f.page, f.limit);
  }

  async obtener(id: string) {
    const factura = await this.repo.detalle(id);
    if (!factura) throw new NotFoundException('Factura no encontrada');
    return factura;
  }

  async generarPdf(id: string) {
    const factura = await this.obtener(id);
    return {
      codigo: factura.codigo as string,
      buffer: await this.pdf.generar(factura),
    };
  }

  private async validarYCalcular(
    dto: CrearFacturaDto,
    fecha: Date,
    session?: ClientSession,
  ): Promise<ResultadoFactura> {
    const cliente = await this.clientes.buscarPorId(dto.clienteId, session);
    if (!cliente)
      throw new UnprocessableEntityException('El cliente no existe');

    const ids = dto.servicioIds.map((id) => new Types.ObjectId(id));
    const servicios = await this.servicios.buscarPorIds(ids, session);
    // Integridad: todos existen, son del cliente, están COMPLETADO y sin factura
    if (servicios.length !== ids.length) {
      throw new UnprocessableEntityException(
        'Alguno de los servicios no existe',
      );
    }
    const ajenos = servicios.filter((s) => !s.clienteId.equals(cliente._id));
    if (ajenos.length > 0) {
      throw new UnprocessableEntityException(
        `Servicios de otro cliente: ${ajenos.map((s) => s.codigo).join(', ')}`,
      );
    }
    const noCompletados = servicios.filter(
      (s) => s.estado !== EstadoServicio.COMPLETADO,
    );
    if (noCompletados.length > 0) {
      throw new UnprocessableEntityException(
        `Solo se facturan servicios COMPLETADO: ${noCompletados.map((s) => s.codigo).join(', ')}`,
      );
    }
    const facturados = servicios.filter((s) => s.facturaId);
    if (facturados.length > 0) {
      throw new ConflictException(
        `Servicios ya facturados: ${facturados.map((s) => s.codigo).join(', ')}`,
      );
    }

    // Descuento: completados del cliente en el mes calendario de la fecha de la factura
    const { desde, hasta } = rangoDelMes(fecha, this.zona);
    const completados = await this.servicios.contarCompletadosCliente(
      cliente._id,
      desde,
      hasta,
      session,
    );

    return calcularFactura(
      servicios.map((s) => ({
        servicioId: s._id.toString(),
        codigo: s.codigo,
        tarifa: dec(s.tarifa),
        distanciaKm: s.distanciaKm,
        inicio: s.inicio,
      })),
      completados,
      this.tasaIva,
      this.zona,
    );
  }

  private fechaFactura(fecha?: string): Date {
    return fecha ? inicioDelDia(fecha, this.zona) : new Date();
  }

  private presentar(c: ResultadoFactura) {
    return {
      lineas: c.lineas.map((l) => ({
        servicioId: l.servicioId,
        codigo: l.codigo,
        distanciaKm: l.distanciaKm,
        inicio: l.inicio,
        tarifa: l.tarifa.toFixed(2),
        porcentajeRecargo: l.porcentajeRecargo.toNumber(),
        motivosRecargo: l.motivosRecargo,
        recargos: l.recargo.toFixed(2),
        importe: l.importe.toFixed(2),
      })),
      subtotal: c.subtotal.toFixed(2),
      recargos: c.recargos.toFixed(2),
      base: c.base.toFixed(2),
      serviciosCompletadosMes: c.serviciosCompletadosMes,
      porcentajeDescuento: c.porcentajeDescuento.toNumber(),
      descuento: c.descuento.toFixed(2),
      baseImponible: c.baseImponible.toFixed(2),
      tasaImpuesto: c.tasaImpuesto.toNumber(),
      impuesto: c.impuesto.toFixed(2),
      total: c.total.toFixed(2),
    };
  }
}

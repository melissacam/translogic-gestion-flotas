import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { finDelDia, inicioDelDia } from '../common/utils/fecha.util';
import { ConsultaOperacionesDto } from './dto/consulta-operaciones.dto';
import { RentabilidadDto } from './dto/rentabilidad.dto';
import { ReportesRepository } from './reportes.repository';

const CERO = Types.Decimal128.fromString('0');

export const DESCRIPCION_CONSULTAS: Record<number, string> = {
  1: 'Servicios cuyo costo operativo supera el promedio de los completados',
  2: 'Participación (%) de cada vehículo en los servicios completados',
  3: 'Clientes con 3 o más servicios completados en el período',
  4: 'Vehículos sin servicios asignados en el rango',
  5: 'Top 5 vehículos por rentabilidad',
  6: 'Facturación mensual por tipo de vehículo',
  7: 'Vehículos con eficiencia menor al promedio de su categoría',
  8: 'Clientes cuya facturación bajó más de 20 % frente al mes anterior',
};

@Injectable()
export class ReportesService {
  constructor(
    private readonly repo: ReportesRepository,
    private readonly config: ConfigService,
  ) {}

  private get zona(): string {
    return this.config.getOrThrow<string>('ZONA_HORARIA');
  }

  async operaciones(dto: ConsultaOperacionesDto) {
    const ahora = DateTime.now().setZone(this.zona);
    // Rango por defecto: últimos 30 días; mes por defecto: el mes anterior
    const desdeTexto =
      dto.desde ?? (ahora.minus({ days: 30 }).toISODate() as string);
    const hastaTexto = dto.hasta ?? (ahora.toISODate() as string);
    const desde = inicioDelDia(desdeTexto, this.zona);
    const hasta = finDelDia(hastaTexto, this.zona);
    const mes = dto.mes ?? ahora.minus({ months: 1 }).toFormat('yyyy-MM');

    const ejecutar: Record<number, () => Promise<unknown[]>> = {
      1: () => this.repo.consulta1(),
      2: () => this.repo.consulta2(),
      3: () => this.repo.consulta3(desde, hasta),
      4: () => this.repo.consulta4(desde, hasta),
      5: () => this.repo.consulta5(),
      6: () =>
        this.repo.consulta6(
          this.zona,
          dto.desde ? desde : undefined,
          dto.hasta ? hasta : undefined,
        ),
      7: () => this.repo.consulta7(),
      8: () => {
        const m = DateTime.fromISO(`${mes}-01`, { zone: 'UTC' });
        const anterior = m.minus({ months: 1 });
        return this.repo.consulta8(
          anterior.toFormat('yyyy-MM'),
          mes,
          anterior.toJSDate(),
          m.toJSDate(),
          m.plus({ months: 1 }).toJSDate(),
        );
      },
    };
    const resultados = await ejecutar[dto.consulta]();
    return {
      consulta: dto.consulta,
      descripcion: DESCRIPCION_CONSULTAS[dto.consulta],
      parametros: { desde: desdeTexto, hasta: hastaTexto, mes },
      total: resultados.length,
      resultados,
    };
  }

  async rentabilidad(dto: RentabilidadDto) {
    const desde = DateTime.fromObject(
      { year: dto.anio, month: 1, day: 1 },
      { zone: this.zona },
    );
    const r = await this.repo.rentabilidad(
      desde.toUTC().toJSDate(),
      desde.endOf('year').toUTC().toJSDate(),
      this.zona,
      dto.mes,
      dto.tipo,
    );
    return {
      filtros: { anio: dto.anio, mes: dto.mes ?? null, tipo: dto.tipo ?? null },
      kpis: r?.kpis?.[0] ?? {
        ingresos: CERO,
        costos: CERO,
        utilidad: CERO,
        margen: 0,
        servicios: 0,
      },
      serviciosPorEstado: r?.serviciosPorEstado ?? [],
      distribucionPorTipo: r?.distribucionPorTipo ?? [],
      comparacionMensual: r?.comparacionMensual ?? [],
      porVehiculo: r?.porVehiculo ?? [],
    };
  }
}

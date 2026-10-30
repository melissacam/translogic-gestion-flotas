import { DollarSign, Percent, Receipt, TrendingUp } from 'lucide';
import { reportesApi } from '../api/reportes.api';
import { badgeTipo, ESTADO_SERVICIO, TIPO_VEHICULO } from '../components/badge';
import { encabezado, tarjeta, tarjetaKpi } from '../components/card';
import { grafico, PALETA } from '../components/chart';
import { h, reemplazar } from '../components/dom';
import { cargarEn, vacio } from '../components/estados';
import { campoSelect } from '../components/select';
import { tablaResponsive } from '../components/table';
import { nombreMes, num, pct, usd } from '../core/format';
import type { Pagina } from '../core/router';
import type { EstadoServicio, Rentabilidad, TipoVehiculo } from '../types';

const COLOR_ESTADO: Record<EstadoServicio, string> = {
  PROGRAMADO: PALETA.pervinca,
  EN_EJECUCION: PALETA.mantequilla,
  COMPLETADO: PALETA.salvia,
  CANCELADO: PALETA.rosaPolvo,
};
const COLOR_TIPO: Record<TipoVehiculo, string> = {
  CAMION_CARGA: PALETA.melocoton,
  FURGONETA_ELECTRICA: PALETA.mentaCielo,
};

export const paginaDashboard: Pagina = (contenedor) => {
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const anio = campoSelect(
    'Año',
    'anio',
    [anioActual - 1, anioActual, anioActual + 1].map((a) => ({ valor: String(a), texto: String(a) })),
    undefined,
    String(anioActual),
  );
  const mes = campoSelect(
    'Mes',
    'mes',
    Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), texto: nombreMes(i + 1) })),
    'Todo el año',
  );
  const tipo = campoSelect(
    'Tipo de vehículo',
    'tipo',
    Object.entries(TIPO_VEHICULO).map(([valor, e]) => ({ valor, texto: e.texto })),
    'Todos',
  );
  const zona = h('div');

  // Cada cambio de filtro vuelve a consultar el endpoint (cálculo en MongoDB)
  const consultar = () =>
    cargarEn(
      zona,
      () => reportesApi.rentabilidad({ anio: anio.control.value, mes: mes.control.value || undefined, tipo: tipo.control.value || undefined }),
      (r) => pintar(r),
      6,
    );
  [anio, mes, tipo].forEach((c) => c.control.addEventListener('change', () => void consultar()));

  function pintar(r: Rentabilidad) {
    const k = r.kpis;
    const sinDatos = k.servicios === 0;
    reemplazar(
      zona,
      h(
        'div',
        { class: 'grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6' },
        tarjetaKpi('Ingresos', usd(k.ingresos), DollarSign, `${k.servicios} servicios completados`),
        tarjetaKpi('Costos operativos', usd(k.costos), Receipt),
        tarjetaKpi('Utilidad', usd(k.utilidad), TrendingUp),
        tarjetaKpi('Margen', pct(k.margen), Percent, 'Utilidad / ingresos'),
      ),
      sinDatos
        ? vacio('Sin servicios completados en el período', 'Cambia el mes, el año o el tipo de vehículo para ver otros resultados.')
        : h(
            'div',
            { class: 'grid gap-4 lg:grid-cols-2' },
            tarjeta(
              `Ingresos vs costos · ${anio.control.value}`,
              grafico(
                {
                  type: 'bar',
                  data: {
                    labels: r.comparacionMensual.map((m) => nombreMes(m.mes)),
                    datasets: [
                      { label: 'Ingresos', data: r.comparacionMensual.map((m) => Number(m.ingresos)), backgroundColor: PALETA.salvia, borderRadius: 4 },
                      { label: 'Costos', data: r.comparacionMensual.map((m) => Number(m.costos)), backgroundColor: PALETA.pervinca, borderRadius: 4 },
                    ],
                  },
                  options: { scales: { y: { beginAtZero: true } } },
                },
                'Barras de ingresos y costos por mes',
              ),
            ),
            tarjeta(
              'Utilidad mensual',
              grafico(
                {
                  type: 'line',
                  data: {
                    labels: r.comparacionMensual.map((m) => nombreMes(m.mes)),
                    datasets: [
                      {
                        label: 'Utilidad',
                        data: r.comparacionMensual.map((m) => Number(m.utilidad)),
                        borderColor: PALETA.salviaFuerte,
                        backgroundColor: PALETA.salviaFuerte,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 3,
                      },
                    ],
                  },
                },
                'Línea de utilidad mensual',
              ),
            ),
            tarjeta(
              'Servicios por estado',
              grafico(
                {
                  type: 'bar',
                  data: {
                    labels: r.serviciosPorEstado.map((e) => ESTADO_SERVICIO[e.estado].texto),
                    datasets: [
                      {
                        label: 'Servicios',
                        data: r.serviciosPorEstado.map((e) => e.cantidad),
                        backgroundColor: r.serviciosPorEstado.map((e) => COLOR_ESTADO[e.estado]),
                        borderRadius: 4,
                      },
                    ],
                  },
                  options: { indexAxis: 'y', plugins: { legend: { display: false } } },
                },
                'Barras de servicios por estado',
                220,
              ),
            ),
            tarjeta(
              'Distribución por tipo de vehículo',
              grafico(
                {
                  type: 'doughnut',
                  data: {
                    labels: r.distribucionPorTipo.map((d) => TIPO_VEHICULO[d.tipo].texto),
                    datasets: [
                      {
                        data: r.distribucionPorTipo.map((d) => Number(d.ingresos)),
                        backgroundColor: r.distribucionPorTipo.map((d) => COLOR_TIPO[d.tipo]),
                        borderColor: '#FFFFFF',
                      },
                    ],
                  },
                  options: { plugins: { legend: { position: 'bottom' } } },
                },
                'Dona de ingresos por tipo de vehículo',
                220,
              ),
            ),
            h(
              'div',
              { class: 'lg:col-span-2' },
              tarjeta(
                'Rentabilidad por vehículo',
                tablaResponsive(r.porVehiculo, [
                  { titulo: 'Placa', celda: (v) => v.placa, principal: true },
                  { titulo: 'Tipo', celda: (v) => badgeTipo(v.tipo) },
                  { titulo: 'Servicios', celda: (v) => v.servicios, alineacion: 'derecha' },
                  { titulo: 'Km', celda: (v) => num(v.kmRecorridos), alineacion: 'derecha', ocultarEnMovil: true },
                  { titulo: 'Ingresos', celda: (v) => usd(v.ingresos), alineacion: 'derecha' },
                  { titulo: 'Costos', celda: (v) => usd(v.costos), alineacion: 'derecha' },
                  { titulo: 'Utilidad', celda: (v) => usd(v.utilidad), alineacion: 'derecha' },
                  { titulo: 'Margen', celda: (v) => pct(v.margen), alineacion: 'derecha' },
                ]),
              ),
            ),
          ),
    );
  }

  reemplazar(
    contenedor,
    encabezado('Panel de rentabilidad', 'Indicadores calculados en el servidor sobre servicios completados'),
    h('div', { class: 'tarjeta p-4 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-x-3' }, anio.contenedor, mes.contenedor, h('div', { class: 'col-span-2 sm:col-span-1' }, tipo.contenedor)),
    zona,
  );
  void consultar();
};

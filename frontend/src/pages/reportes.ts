import { Play } from 'lucide';
import { reportesApi } from '../api/reportes.api';
import { badgeEstadoVehiculo, badgeTipo } from '../components/badge';
import { boton } from '../components/button';
import { encabezado } from '../components/card';
import { h, reemplazar, type Hijo } from '../components/dom';
import { cargarEn, vacio } from '../components/estados';
import { campoTexto } from '../components/input';
import { tablaResponsive, type Columna } from '../components/table';
import { fecha, isoLocal, num, pct, usd } from '../core/format';
import type { Pagina } from '../core/router';
import type { EstadoVehiculo, TipoVehiculo } from '../types';

type Fila = Record<string, unknown>;
type Parametro = 'rango' | 'mes';

const t = (campo: string) => (f: Fila) => String(f[campo] ?? '—');
const dinero = (campo: string) => (f: Fila) => usd(f[campo] as string);
const numero = (campo: string, sufijo = '') => (f: Fila) => num(f[campo] as number, sufijo);
const tipo = (f: Fila): Hijo => badgeTipo(f.tipo as TipoVehiculo);

interface Definicion {
  titulo: string;
  explicacion: string;
  parametros: Parametro[];
  columnas: Columna<Fila>[];
}

const CONSULTAS: Record<number, Definicion> = {
  1: {
    titulo: 'Costo sobre el promedio',
    explicacion: 'Servicios cuyo costo operativo supera el promedio de todos los servicios completados.',
    parametros: [],
    columnas: [
      { titulo: 'Código', celda: t('codigo'), principal: true },
      { titulo: 'Fecha', celda: (f) => fecha(f.fecha as string) },
      { titulo: 'Ruta', celda: (f) => `${String(f.origen)} → ${String(f.destino)}`, ocultarEnMovil: true },
      { titulo: 'Placa', celda: t('placa') },
      { titulo: 'Costo operativo', celda: dinero('costoOperativo'), alineacion: 'derecha' },
      { titulo: 'Promedio', celda: dinero('promedioCompletados'), alineacion: 'derecha' },
      { titulo: 'Diferencia', celda: dinero('diferencia'), alineacion: 'derecha' },
    ],
  },
  2: {
    titulo: 'Participación por vehículo',
    explicacion: 'Porcentaje de los servicios completados que realizó cada vehículo.',
    parametros: [],
    columnas: [
      { titulo: 'Placa', celda: t('placa'), principal: true },
      { titulo: 'Tipo', celda: tipo },
      { titulo: 'Servicios', celda: numero('servicios'), alineacion: 'derecha' },
      { titulo: 'Participación', celda: (f) => pct(f.participacionPct as number), alineacion: 'derecha' },
      { titulo: 'Ingresos', celda: dinero('ingresos'), alineacion: 'derecha' },
    ],
  },
  3: {
    titulo: 'Clientes frecuentes',
    explicacion: 'Clientes con 3 o más servicios completados en el período.',
    parametros: ['rango'],
    columnas: [
      { titulo: 'Cliente', celda: t('nombre'), principal: true },
      { titulo: 'Identificación', celda: t('identificacion') },
      { titulo: 'Completados', celda: numero('completados'), alineacion: 'derecha' },
      { titulo: 'Km', celda: numero('kmTotales', ' km'), alineacion: 'derecha' },
      { titulo: 'Ingresos', celda: dinero('ingresos'), alineacion: 'derecha' },
    ],
  },
  4: {
    titulo: 'Vehículos sin asignaciones',
    explicacion: 'Vehículos activos sin servicios (no cancelados) que se crucen con el rango.',
    parametros: ['rango'],
    columnas: [
      { titulo: 'Placa', celda: t('placa'), principal: true },
      { titulo: 'Tipo', celda: tipo },
      { titulo: 'Marca / modelo', celda: (f) => `${String(f.marca)} ${String(f.modelo)}` },
      { titulo: 'Estado', celda: (f) => badgeEstadoVehiculo(f.estado as EstadoVehiculo) },
      { titulo: 'Kilometraje', celda: numero('kilometraje', ' km'), alineacion: 'derecha' },
    ],
  },
  5: {
    titulo: 'Top 5 rentabilidad',
    explicacion: 'Los 5 vehículos con mayor utilidad (ingresos − costos operativos).',
    parametros: [],
    columnas: [
      { titulo: 'Placa', celda: t('placa'), principal: true },
      { titulo: 'Tipo', celda: tipo },
      { titulo: 'Servicios', celda: numero('servicios'), alineacion: 'derecha' },
      { titulo: 'Ingresos', celda: dinero('ingresos'), alineacion: 'derecha' },
      { titulo: 'Costos', celda: dinero('costos'), alineacion: 'derecha' },
      { titulo: 'Utilidad', celda: dinero('utilidad'), alineacion: 'derecha' },
      { titulo: 'Margen', celda: (f) => pct(f.margen as string), alineacion: 'derecha' },
    ],
  },
  6: {
    titulo: 'Facturación mensual por tipo',
    explicacion: 'Importe facturado (tarifa + recargos) agrupado por mes y tipo de vehículo.',
    parametros: ['rango'],
    columnas: [
      { titulo: 'Mes', celda: t('mes'), principal: true },
      { titulo: 'Tipo', celda: tipo },
      { titulo: 'Servicios', celda: numero('servicios'), alineacion: 'derecha' },
      { titulo: 'Facturado', celda: dinero('facturado'), alineacion: 'derecha' },
    ],
  },
  7: {
    titulo: 'Eficiencia bajo el promedio',
    explicacion: 'Vehículos cuya eficiencia (km por USD de costo) es menor al promedio de su categoría.',
    parametros: [],
    columnas: [
      { titulo: 'Placa', celda: t('placa'), principal: true },
      { titulo: 'Tipo', celda: tipo },
      { titulo: 'Km', celda: numero('kmRecorridos', ' km'), alineacion: 'derecha' },
      { titulo: 'Costo operativo', celda: dinero('costoOperativo'), alineacion: 'derecha' },
      { titulo: 'Km / USD', celda: numero('eficienciaKmPorUsd'), alineacion: 'derecha' },
      { titulo: 'Promedio tipo', celda: numero('promedioCategoria'), alineacion: 'derecha' },
    ],
  },
  8: {
    titulo: 'Caída de facturación',
    explicacion: 'Clientes cuya facturación del mes bajó más de 20 % frente al mes anterior.',
    parametros: ['mes'],
    columnas: [
      { titulo: 'Cliente', celda: t('nombre'), principal: true },
      { titulo: 'Identificación', celda: t('identificacion') },
      { titulo: 'Mes anterior', celda: dinero('totalMesAnterior'), alineacion: 'derecha' },
      { titulo: 'Mes', celda: dinero('totalMes'), alineacion: 'derecha' },
      { titulo: 'Variación', celda: (f) => pct(f.variacionPct as string), alineacion: 'derecha' },
    ],
  },
};

export const paginaReportes: Pagina = (contenedor) => {
  let actual = 1;
  const hoy = isoLocal();
  const hace30 = isoLocal(new Date(Date.now() - 30 * 86_400_000));
  const mesAnterior = isoLocal(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15)).slice(0, 7);
  const desde = campoTexto('Desde', 'desde', { tipo: 'date', valor: hace30 });
  const hasta = campoTexto('Hasta', 'hasta', { tipo: 'date', valor: hoy });
  const mes = campoTexto('Mes', 'mes', { tipo: 'month', valor: mesAnterior });
  const selector = h('div', { class: 'flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap', role: 'tablist' });
  const cabecera = h('div', { class: 'mb-3' });
  const parametros = h('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-x-3 items-end' });
  const resultado = h('div');
  const ejecutar = boton('Consultar', { variante: 'primario', icono: Play, clase: 'mb-6 sm:mb-0 sm:self-start sm:mt-7' });

  const consultar = () =>
    cargarEn(
      resultado,
      () =>
        reportesApi.operaciones({
          consulta: actual,
          ...(CONSULTAS[actual].parametros.includes('rango') ? { desde: desde.control.value, hasta: hasta.control.value } : {}),
          ...(CONSULTAS[actual].parametros.includes('mes') ? { mes: mes.control.value } : {}),
        }),
      (r) =>
        reemplazar(
          resultado,
          h('p', { class: 'text-sm text-tinta-suave mb-3' }, `${r.total} resultado${r.total === 1 ? '' : 's'}`),
          r.total === 0 ? vacio('Sin resultados', 'Ningún registro cumple la condición con los parámetros elegidos.') : tablaResponsive(r.resultados, CONSULTAS[actual].columnas),
        ),
    );
  ejecutar.addEventListener('click', () => void consultar());

  function seleccionar(n: number) {
    actual = n;
    const def = CONSULTAS[n];
    reemplazar(
      selector,
      ...Object.entries(CONSULTAS).map(([k, d]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(Number(k) === n),
            class: `btn whitespace-nowrap ${Number(k) === n ? 'btn-primario' : 'btn-secundario'}`,
            onClick: () => seleccionar(Number(k)),
          },
          `${k}. ${d.titulo}`,
        ),
      ),
    );
    reemplazar(cabecera, h('h2', { class: 'text-lg font-semibold' }, `Consulta ${n}: ${def.titulo}`), h('p', { class: 'text-sm text-tinta-suave' }, def.explicacion));
    reemplazar(
      parametros,
      def.parametros.includes('rango') ? [desde.contenedor, hasta.contenedor] : null,
      def.parametros.includes('mes') ? mes.contenedor : null,
      ejecutar,
    );
    void consultar();
  }

  reemplazar(
    contenedor,
    encabezado('Reportes operativos', 'Consultas avanzadas resueltas con agregaciones de MongoDB'),
    selector,
    h('section', { class: 'tarjeta p-4 md:p-6 mt-2 mb-4' }, cabecera, parametros),
    resultado,
  );
  seleccionar(1);
};

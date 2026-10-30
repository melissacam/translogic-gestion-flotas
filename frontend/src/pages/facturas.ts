import { Download, Eye, FileCheck2 } from 'lucide';
import { clientesApi } from '../api/clientes.api';
import { facturasApi } from '../api/facturas.api';
import { serviciosApi } from '../api/servicios.api';
import { boton, conCarga } from '../components/button';
import { encabezado, filaDato, tarjeta } from '../components/card';
import { h, reemplazar } from '../components/dom';
import { cargarEn, vacio } from '../components/estados';
import { campoTexto } from '../components/input';
import { abrirModal } from '../components/modal';
import { paginacion } from '../components/pagination';
import { campoSelect, opciones } from '../components/select';
import { tablaResponsive } from '../components/table';
import { toast } from '../components/toast';
import { fecha, isoLocal, mesActual, num, usd, ultimoDiaDelMes } from '../core/format';
import type { Pagina } from '../core/router';
import type { Factura, ResumenFactura, Servicio } from '../types';

function resumen(r: ResumenFactura): HTMLElement {
  return h(
    'div',
    null,
    filaDato('Subtotal', usd(r.subtotal)),
    filaDato('Recargos (domingo / > 300 km)', usd(r.recargos)),
    filaDato('Base', usd(r.base)),
    filaDato(`Descuento ${r.porcentajeDescuento} % (${r.serviciosCompletadosMes} completados en el mes)`, `− ${usd(r.descuento)}`),
    filaDato('Base imponible', usd(r.baseImponible)),
    filaDato(`IVA ${num(r.tasaImpuesto * 100)} %`, usd(r.impuesto)),
    filaDato('Total', usd(r.total), true),
  );
}

async function descargarPdf(f: Factura, btn: HTMLButtonElement) {
  try {
    const { blob, nombre } = await conCarga(btn, () => facturasApi.pdf(f.id), 'Generando PDF…');
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nombre ?? `${f.codigo}.pdf` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    toast((err as Error).message, 'error');
  }
}

function verFactura(f: Factura) {
  const modal = abrirModal(`Factura ${f.codigo}`, { lateral: true });
  void cargarEn(
    modal.cuerpo,
    () => facturasApi.obtener(f.id),
    (d) => {
      const pdf = boton('Descargar comprobante PDF', { variante: 'primario', icono: Download, clase: 'w-full mb-4' });
      pdf.addEventListener('click', () => void descargarPdf(d, pdf));
      reemplazar(
        modal.cuerpo,
        h('p', { class: 'text-sm bg-mantequilla rounded-app px-3 py-2 mb-4' }, 'Comprobante simulado — sin validez tributaria ante el SRI'),
        pdf,
        filaDato('Cliente', d.cliente?.nombre ?? '—'),
        filaDato('Identificación', d.cliente?.identificacion ?? '—'),
        filaDato('Fecha', fecha(d.fecha)),
        h('h3', { class: 'font-semibold mt-4 mb-2' }, 'Servicios'),
        ...(d.detalles ?? []).map((l) =>
          h(
            'div',
            { class: 'border-b border-borde py-2 text-sm' },
            h('div', { class: 'flex justify-between font-medium' }, h('span', null, l.codigoServicio), h('span', { class: 'tabular-nums' }, usd(l.importe))),
            h(
              'p',
              { class: 'text-tinta-suave' },
              `${l.servicio?.origen ?? ''} → ${l.servicio?.destino ?? ''} · ${num(l.servicio?.distanciaKm, ' km')} · tarifa ${usd(l.tarifa)}${l.porcentajeRecargo ? ` · recargo ${l.porcentajeRecargo} %` : ''}`,
            ),
          ),
        ),
        h('div', { class: 'mt-4' }, resumen(d)),
      );
    },
  );
}

export const paginaFacturas: Pagina = (contenedor) => {
  // ---------- Emitir ----------
  const cliente = campoSelect('Cliente', 'clienteId', [], 'Cargando clientes…');
  const mes = campoTexto('Mes de los servicios', 'mes', { tipo: 'month', valor: mesActual() });
  const pendientes = h('div');
  const vistaPrevia = h('div');
  const seleccion = new Set<string>();

  void clientesApi
    .listar({ limit: 50 })
    .then((r) => opciones(cliente.control, r.data.map((c) => ({ valor: c.id, texto: c.nombre })), 'Selecciona un cliente'))
    .catch((err: Error) => toast(err.message, 'error'));

  // Fecha de la factura: hoy si es el mes en curso, si no el último día del mes elegido
  const fechaFactura = () => (mes.control.value === mesActual() ? isoLocal() : ultimoDiaDelMes(mes.control.value));

  const cargarPendientes = () => {
    seleccion.clear();
    reemplazar(vistaPrevia);
    if (!cliente.control.value || !mes.control.value) {
      reemplazar(pendientes, vacio('Elige cliente y mes', 'Se listarán los servicios completados aún sin facturar.'));
      return;
    }
    void cargarEn(
      pendientes,
      () =>
        serviciosApi.listar({
          clienteId: cliente.control.value,
          estado: 'COMPLETADO',
          facturado: false,
          desde: `${mes.control.value}-01`,
          hasta: ultimoDiaDelMes(mes.control.value),
          limit: 50,
          sort: 'fecha:asc',
        }),
      (r) => pintarPendientes(r.data),
      3,
    );
  };
  [cliente, mes].forEach((c) => c.control.addEventListener('change', cargarPendientes));

  function pintarPendientes(servicios: Servicio[]) {
    if (servicios.length === 0) {
      reemplazar(pendientes, vacio('Sin servicios pendientes de facturar', 'Este cliente no tiene servicios completados sin factura en el mes elegido.'));
      return;
    }
    const previsualizar = boton('Previsualizar factura', { variante: 'primario', icono: Eye });
    previsualizar.disabled = true;
    const actualizar = () => (previsualizar.disabled = seleccion.size === 0);
    const todos = h('input', { type: 'checkbox', class: 'size-5 accent-salvia-fuerte', 'aria-label': 'Seleccionar todos' });
    const casillas = servicios.map((s) => {
      const c = h('input', { type: 'checkbox', class: 'size-5 accent-salvia-fuerte', value: s.id, 'aria-label': `Seleccionar ${s.codigo}` });
      c.addEventListener('change', () => {
        if (c.checked) seleccion.add(s.id);
        else seleccion.delete(s.id);
        todos.checked = seleccion.size === servicios.length;
        actualizar();
        reemplazar(vistaPrevia);
      });
      return c;
    });
    todos.addEventListener('change', () => {
      casillas.forEach((c) => {
        c.checked = todos.checked;
        c.dispatchEvent(new Event('change'));
      });
    });
    previsualizar.addEventListener('click', async () => {
      try {
        const sim = await conCarga(previsualizar, () => facturasApi.simular({ clienteId: cliente.control.value, servicioIds: [...seleccion], fecha: fechaFactura() }), 'Calculando…');
        const emitir = boton('Confirmar y emitir factura', { variante: 'primario', icono: FileCheck2, clase: 'w-full mt-4' });
        emitir.addEventListener('click', async () => {
          try {
            const f = await conCarga(emitir, () => facturasApi.crear({ clienteId: cliente.control.value, servicioIds: [...seleccion], fecha: fechaFactura() }), 'Emitiendo…');
            toast(`Factura ${f.codigo} emitida`);
            cargarPendientes();
            void recargarEmitidas();
            verFactura(f);
          } catch (err) {
            toast((err as Error).message, 'error');
            cargarPendientes();
          }
        });
        reemplazar(
          vistaPrevia,
          tarjeta(
            `Vista previa · periodo ${sim.periodo}`,
            ...sim.lineas.map((l) =>
              filaDato(`${l.codigo}${l.motivosRecargo.length ? ` · ${l.motivosRecargo.join(', ')}` : ''}`, `${usd(l.tarifa)}${l.porcentajeRecargo ? ` + ${usd(l.recargos)}` : ''}`),
            ),
            h('div', { class: 'border-t border-borde mt-2 pt-2' }, resumen(sim)),
            emitir,
          ),
        );
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    });

    reemplazar(
      pendientes,
      h('label', { class: 'flex items-center gap-3 min-h-11 text-sm font-medium' }, todos, `Seleccionar todos (${servicios.length})`),
      h(
        'ul',
        { class: 'flex flex-col divide-y divide-borde border-y border-borde mb-4' },
        ...servicios.map((s, i) =>
          h(
            'li',
            null,
            h(
              'label',
              { class: 'flex items-center gap-3 py-3 min-h-11 cursor-pointer' },
              casillas[i],
              h(
                'span',
                { class: 'flex-1 text-sm' },
                h('span', { class: 'font-semibold block' }, `${s.codigo} · ${fecha(s.inicio)}`),
                h('span', { class: 'text-tinta-suave' }, `${s.origen} → ${s.destino} · ${num(s.distanciaKm, ' km')}`),
              ),
              h('span', { class: 'tabular-nums text-sm' }, usd(s.tarifa)),
            ),
          ),
        ),
      ),
      previsualizar,
    );
  }

  // ---------- Emitidas ----------
  const estadoLista = { page: 1 };
  const filtroMes = campoTexto('Filtrar por mes', 'mesFiltro', { tipo: 'month' });
  const emitidas = h('div');
  const recargarEmitidas = () =>
    cargarEn(
      emitidas,
      () => facturasApi.listar({ page: estadoLista.page, limit: 10, mes: filtroMes.control.value || undefined }),
      (r) => {
        if (r.total === 0) {
          reemplazar(emitidas, vacio('No hay facturas emitidas', 'Las facturas que emitas aparecerán aquí con su comprobante PDF.'));
          return;
        }
        reemplazar(
          emitidas,
          tablaResponsive(
            r.data,
            [
              { titulo: 'Código', celda: (f) => h('span', { class: 'font-semibold' }, f.codigo), principal: true },
              { titulo: 'Cliente', celda: (f) => f.cliente?.nombre ?? '—' },
              { titulo: 'Fecha', celda: (f) => fecha(f.fecha) },
              { titulo: 'Servicios', celda: (f) => f.cantidadServicios, alineacion: 'derecha' },
              { titulo: 'Descuento', celda: (f) => `${f.porcentajeDescuento} %`, alineacion: 'derecha', ocultarEnMovil: true },
              { titulo: 'Total', celda: (f) => usd(f.total), alineacion: 'derecha' },
            ],
            { alSeleccionar: (f) => verFactura(f) },
          ),
          paginacion(r.page, r.totalPages, r.total, (p) => {
            estadoLista.page = p;
            void recargarEmitidas();
          }),
        );
      },
    );
  filtroMes.control.addEventListener('change', () => {
    estadoLista.page = 1;
    void recargarEmitidas();
  });

  reemplazar(
    contenedor,
    encabezado('Facturación', 'Emite comprobantes a partir de servicios completados'),
    h(
      'div',
      { class: 'grid gap-4 lg:grid-cols-2 mb-8' },
      tarjeta('Nueva factura', h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-x-3' }, cliente.contenedor, mes.contenedor), pendientes),
      vistaPrevia,
    ),
    h('h2', { class: 'text-lg font-semibold mb-3 flex items-center gap-2' }, 'Facturas emitidas'),
    h('div', { class: 'tarjeta p-4 mb-4 max-w-xs' }, filtroMes.contenedor),
    emitidas,
  );
  cargarPendientes();
  void recargarEmitidas();
};

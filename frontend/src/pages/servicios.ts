import { Ban, CircleCheck, History, Pencil, Play, Plus, RefreshCw, Truck } from 'lucide';
import { clientesApi } from '../api/clientes.api';
import { ApiError } from '../api/http';
import { serviciosApi } from '../api/servicios.api';
import { vehiculosApi } from '../api/vehiculos.api';
import { badgeEstadoServicio, badgeTipo, ESTADO_SERVICIO, TIPO_VEHICULO } from '../components/badge';
import { boton, conCarga } from '../components/button';
import { encabezado, filaDato } from '../components/card';
import { debounce, h, icono, reemplazar } from '../components/dom';
import { cargarEn, skeleton, vacio } from '../components/estados';
import { campoNumero, campoTexto, casilla } from '../components/input';
import { abrirModal, confirmar, type Modal } from '../components/modal';
import { paginacion } from '../components/pagination';
import { campoSelect, opciones, type Opcion } from '../components/select';
import { tablaResponsive } from '../components/table';
import { toast } from '../components/toast';
import { fecha, fechaHora, isoLocal, num, usd } from '../core/format';
import type { Pagina } from '../core/router';
import {
  CODIGO_SERVICIO,
  enlazarValidacion,
  noNegativo,
  numeroEntre,
  patron,
  requerido,
} from '../core/validators';
import type { DesgloseTarifa, EstadoServicio, Servicio, Vehiculo } from '../types';

// Copia de la máquina de estados solo para decidir qué botones mostrar (el backend decide)
const ACCIONES: Record<EstadoServicio, { destino: EstadoServicio; texto: string; icono: typeof Play; variante: 'primario' | 'peligro' }[]> = {
  PROGRAMADO: [
    { destino: 'EN_EJECUCION', texto: 'Iniciar', icono: Play, variante: 'primario' },
    { destino: 'CANCELADO', texto: 'Cancelar', icono: Ban, variante: 'peligro' },
  ],
  EN_EJECUCION: [
    { destino: 'COMPLETADO', texto: 'Completar', icono: CircleCheck, variante: 'primario' },
    { destino: 'CANCELADO', texto: 'Cancelar', icono: Ban, variante: 'peligro' },
  ],
  COMPLETADO: [],
  CANCELADO: [],
};

const MENSAJE_CONCURRENCIA = 'Otro operador asignó este vehículo en ese horario. Actualiza y elige otro.';
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const ORDENES: Opcion[] = [
  { valor: 'fecha:desc', texto: 'Fecha (recientes primero)' },
  { valor: 'fecha:asc', texto: 'Fecha (antiguos primero)' },
  { valor: 'codigo:asc', texto: 'Código (A-Z)' },
  { valor: 'tarifa:desc', texto: 'Tarifa (mayor primero)' },
];

function etiquetaVehiculo(v: Vehiculo): string {
  const extra = v.tipo === 'FURGONETA_ELECTRICA' ? ` · ${num(v.autonomiaDisponibleKm)} km disp.` : ` · ${num(v.capacidadCargaKg)} kg`;
  return `${v.placa} · ${TIPO_VEHICULO[v.tipo].texto}${extra}`;
}

function desglose(d: DesgloseTarifa | null | undefined): HTMLElement {
  if (!d) return h('p', { class: 'text-sm text-tinta-suave' }, 'La tarifa se calcula al asignar un vehículo.');
  return h(
    'div',
    null,
    d.costoCombustible ? filaDato('Costo de combustible', usd(d.costoCombustible)) : null,
    d.costoEnergetico ? filaDato('Costo energético', usd(d.costoEnergetico)) : null,
    filaDato(d.tipo === 'CAMION_CARGA' ? 'Mantenimiento' : 'Costo fijo operativo', usd(d.costoMantenimiento)),
    filaDato('Costo operativo', usd(d.costoOperativo)),
    filaDato(`Tarifa base (margen ${d.tipo === 'CAMION_CARGA' ? '35' : '30'} %)`, usd(d.tarifaBase)),
    d.motivoAjuste ? filaDato(d.motivoAjuste, `+${d.ajustePorcentaje} %`) : null,
    filaDato('Tarifa', usd(d.tarifa)),
    ...d.motivosRecargo.map((m) => filaDato(m, '')),
    d.recargoPorcentaje ? filaDato(`Recargos (${d.recargoPorcentaje} %)`, usd(d.recargos)) : null,
    d.autonomiaDisponibleKm ? filaDato('Autonomía disponible', num(d.autonomiaDisponibleKm, ' km')) : null,
    filaDato('Importe estimado', usd(d.importe), true),
  );
}

export const paginaServicios: Pagina = (contenedor) => {
  const estado = { page: 1 };
  const filtroEstado = campoSelect('Estado', 'estado', Object.entries(ESTADO_SERVICIO).map(([valor, e]) => ({ valor, texto: e.texto })), 'Todos');
  const filtroCliente = campoSelect('Cliente', 'clienteId', [], 'Todos');
  const filtroTipo = campoSelect('Tipo de vehículo', 'tipoVehiculo', Object.entries(TIPO_VEHICULO).map(([valor, e]) => ({ valor, texto: e.texto })), 'Todos');
  const desde = campoTexto('Desde', 'desde', { tipo: 'date' });
  const hasta = campoTexto('Hasta', 'hasta', { tipo: 'date' });
  const codigo = campoTexto('Código', 'codigo', { placeholder: 'SRV-…' });
  const orden = campoSelect('Ordenar por', 'sort', ORDENES, undefined, 'fecha:desc');
  const lista = h('div');
  let clientes: Opcion[] = [];

  void clientesApi
    .listar({ limit: 50 })
    .then((r) => {
      clientes = r.data.map((c) => ({ valor: c.id, texto: c.nombre }));
      opciones(filtroCliente.control, clientes, 'Todos');
    })
    .catch(() => undefined);

  // Filtros combinables, orden y paginación resueltos en el servidor
  const recargar = () =>
    cargarEn(
      lista,
      () =>
        serviciosApi.listar({
          page: estado.page,
          limit: 10,
          estado: filtroEstado.control.value || undefined,
          clienteId: filtroCliente.control.value || undefined,
          tipoVehiculo: filtroTipo.control.value || undefined,
          desde: desde.control.value || undefined,
          hasta: hasta.control.value || undefined,
          codigo: codigo.control.value.trim() || undefined,
          sort: orden.control.value,
        }),
      (r) => {
        if (r.total === 0) {
          reemplazar(lista, vacio('No hay servicios con esos filtros', 'Ajusta el estado, cliente o rango de fechas, o registra un servicio nuevo.'));
          return;
        }
        reemplazar(
          lista,
          tablaResponsive(
            r.data,
            [
              { titulo: 'Código', celda: (s) => h('span', { class: 'font-semibold' }, s.codigo), principal: true },
              { titulo: 'Fecha', celda: (s) => `${fecha(s.inicio)} ${s.horaInicio}` },
              { titulo: 'Cliente', celda: (s) => s.cliente?.nombre ?? '—' },
              { titulo: 'Ruta', celda: (s) => `${s.origen} → ${s.destino}`, ocultarEnMovil: true },
              { titulo: 'Vehículo', celda: (s) => s.vehiculo?.placa ?? 'Sin asignar' },
              { titulo: 'Estado', celda: (s) => badgeEstadoServicio(s.estado) },
              { titulo: 'Tarifa', celda: (s) => usd(s.tarifa), alineacion: 'derecha' },
            ],
            { alSeleccionar: (s) => detalle(s.id) },
          ),
          paginacion(r.page, r.totalPages, r.total, (p) => {
            estado.page = p;
            void recargar();
          }),
        );
      },
    );

  const filtrar = () => {
    estado.page = 1;
    void recargar();
  };
  [filtroEstado, filtroCliente, filtroTipo, desde, hasta, orden].forEach((c) => c.control.addEventListener('change', filtrar));
  codigo.control.addEventListener('input', debounce(filtrar, 300));

  async function vehiculosAsignables(): Promise<Vehiculo[]> {
    return (await vehiculosApi.listar({ asignables: true, limit: 50 })).data;
  }

  // Formulario de registro / edición con simulación de tarifa en vivo
  async function formulario(s?: Servicio) {
    const edicion = Boolean(s);
    const modal = abrirModal(edicion ? `Editar ${s!.codigo}` : 'Nuevo servicio');
    modal.cuerpo.append(skeleton(3));
    let vehiculos: Vehiculo[] = [];
    try {
      vehiculos = await vehiculosAsignables();
    } catch (err) {
      modal.cerrar();
      toast((err as Error).message, 'error');
      return;
    }
    const cod = campoTexto('Código', 'codigo', { valor: s?.codigo ?? '', placeholder: 'SRV-2026-0101', soloLectura: edicion });
    const cliente = campoSelect('Cliente', 'clienteId', clientes, 'Selecciona un cliente', s?.clienteId);
    const origen = campoTexto('Origen', 'origen', { valor: s?.origen });
    const destino = campoTexto('Destino', 'destino', { valor: s?.destino });
    const distancia = campoNumero('Distancia (km)', 'distanciaKm', { valor: s?.distanciaKm, min: 0 });
    const peso = campoNumero('Peso de la carga (kg)', 'pesoCargaKg', { valor: s?.pesoCargaKg ?? 0, min: 0 });
    const dia = campoTexto('Fecha', 'fecha', { tipo: 'date', valor: s ? isoLocal(new Date(s.inicio)) : isoLocal() });
    const horaIni = campoTexto('Hora de inicio', 'horaInicio', { tipo: 'time', valor: s?.horaInicio ?? '08:00' });
    const horaFin = campoTexto('Hora fin estimada', 'horaFinEstimada', { tipo: 'time', valor: s?.horaFinEstimada ?? '12:00' });
    const vehiculo = campoSelect(
      'Vehículo (opcional)',
      'vehiculoId',
      vehiculos.map((v) => ({ valor: v.id, texto: etiquetaVehiculo(v) })),
      'Asignar después',
      s?.vehiculoId ?? undefined,
    );
    if (edicion) {
      vehiculo.control.disabled = true;
      vehiculo.contenedor.querySelector('label')!.textContent = 'Vehículo (se cambia desde «Asignar»)';
    }
    const recarga = casilla('Recarga planificada en ruta (furgonetas)', 'recargaPlanificada', s?.recargaPlanificada);
    const simulacion = h('div', { class: 'bg-fondo rounded-app p-4', 'aria-live': 'polite' });

    const valido = enlazarValidacion([
      { ...cod, reglas: [requerido(), patron(CODIGO_SERVICIO, '3 a 20 caracteres: letras, números y guiones')] },
      { ...cliente, reglas: [requerido('Selecciona un cliente')] },
      { ...origen, reglas: [requerido()] },
      { ...destino, reglas: [requerido()] },
      { ...distancia, reglas: [numeroEntre(0, 5000, 'La distancia debe ser mayor a 0 km', true)] },
      { ...peso, reglas: [noNegativo('El peso no puede ser negativo')] },
      { ...dia, reglas: [requerido()] },
      { ...horaIni, reglas: [patron(HORA, 'Hora inválida')] },
      {
        ...horaFin,
        reglas: [patron(HORA, 'Hora inválida'), (v) => (v > horaIni.control.value ? null : 'Debe ser posterior a la hora de inicio')],
      },
    ]);

    let secuencia = 0;
    const simular = debounce(async () => {
      const vehiculoId = vehiculo.control.value || s?.vehiculoId;
      const d = Number(distancia.control.value);
      const p = Number(peso.control.value);
      if (!vehiculoId) {
        reemplazar(simulacion, h('p', { class: 'text-sm text-tinta-suave' }, 'Elige un vehículo para ver la tarifa estimada en vivo.'));
        return;
      }
      if (!(d > 0) || p < 0 || !dia.control.value) {
        reemplazar(simulacion, h('p', { class: 'text-sm text-tinta-suave' }, 'Completa distancia, peso y fecha para simular.'));
        return;
      }
      const yo = ++secuencia;
      reemplazar(simulacion, h('p', { class: 'text-sm text-tinta-suave' }, 'Calculando…'));
      try {
        const r = await serviciosApi.simularTarifa({ vehiculoId, distanciaKm: d, pesoCargaKg: p, fecha: dia.control.value, horaInicio: horaIni.control.value || undefined });
        if (yo !== secuencia) return;
        reemplazar(
          simulacion,
          h('p', { class: 'text-sm font-semibold mb-2' }, `Simulación · ${r.vehiculo.placa}`),
          desglose(r),
          ...r.advertencias.map((a) => h('p', { class: 'mt-2 text-sm bg-mantequilla rounded-app px-3 py-2' }, a)),
        );
      } catch (err) {
        if (yo !== secuencia) return;
        reemplazar(simulacion, h('p', { class: 'text-sm text-error', role: 'alert' }, (err as Error).message));
      }
    }, 400);
    [vehiculo, distancia, peso, dia, horaIni].forEach((c) => {
      c.control.addEventListener('input', simular);
      c.control.addEventListener('change', simular);
    });
    simular();

    const guardar = boton(edicion ? 'Guardar cambios' : 'Registrar servicio', { variante: 'primario' });
    const form = h(
      'form',
      {
        class: 'grid grid-cols-1 md:grid-cols-2 gap-x-4',
        novalidate: true,
        onSubmit: async (e: SubmitEvent) => {
          e.preventDefault();
          if (!valido()) return;
          const datos: Record<string, unknown> = {
            clienteId: cliente.control.value,
            origen: origen.control.value.trim(),
            destino: destino.control.value.trim(),
            distanciaKm: Number(distancia.control.value),
            pesoCargaKg: Number(peso.control.value),
            fecha: dia.control.value,
            horaInicio: horaIni.control.value,
            horaFinEstimada: horaFin.control.value,
            recargaPlanificada: recarga.control.checked,
          };
          if (edicion) datos.version = s!.version;
          else {
            datos.codigo = cod.control.value.trim().toUpperCase();
            if (vehiculo.control.value) datos.vehiculoId = vehiculo.control.value;
          }
          try {
            const r = await conCarga(guardar, () => (edicion ? serviciosApi.actualizar(s!.id, datos) : serviciosApi.crear(datos)), 'Guardando…');
            toast(edicion ? 'Servicio actualizado' : `Servicio ${r.codigo} registrado`);
            modal.cerrar();
            void recargar();
            if (edicion) detalle(s!.id);
          } catch (err) {
            if (err instanceof ApiError && err.esConflicto && /codigo/.test(err.message)) cod.error('Ya existe un servicio con ese código');
            else if (err instanceof ApiError && err.esConflicto) toast(datos.vehiculoId ? MENSAJE_CONCURRENCIA : err.message, 'error');
            else toast((err as Error).message, 'error');
          }
        },
      },
      cod.contenedor,
      cliente.contenedor,
      origen.contenedor,
      destino.contenedor,
      distancia.contenedor,
      peso.contenedor,
      dia.contenedor,
      h('div', { class: 'grid grid-cols-2 gap-3' }, horaIni.contenedor, horaFin.contenedor),
      h('div', { class: 'md:col-span-2' }, vehiculo.contenedor, recarga.contenedor),
      h('div', { class: 'md:col-span-2 mt-2' }, simulacion),
    );
    guardar.addEventListener('click', () => form.requestSubmit());
    reemplazar(modal.cuerpo, form);
    modal.pie.append(boton('Cancelar', { onClick: () => modal.cerrar() }), guardar);
  }

  // Panel lateral (hoja inferior en móvil) con detalle, acciones e historial
  function detalle(id: string) {
    const modal = abrirModal('Detalle del servicio', { lateral: true });
    const pintar = () => cargarEn(modal.cuerpo, () => Promise.all([serviciosApi.obtener(id), serviciosApi.historial(id)]), ([s, hist]) => contenidoDetalle(modal, s, hist, pintar));
    void pintar();
  }

  function contenidoDetalle(modal: Modal, s: Servicio, historial: Awaited<ReturnType<typeof serviciosApi.historial>>, refrescar: () => Promise<void>) {
    const acciones = ACCIONES[s.estado];
    const tras = async () => {
      await refrescar();
      void recargar();
    };
    reemplazar(
      modal.cuerpo,
      h(
        'div',
        { class: 'flex flex-wrap items-center gap-2 mb-3' },
        h('p', { class: 'text-lg font-semibold mr-auto' }, s.codigo),
        badgeEstadoServicio(s.estado),
        s.vehiculo ? badgeTipo(s.vehiculo.tipo) : null,
      ),
      filaDato('Cliente', s.cliente?.nombre ?? '—'),
      filaDato('Ruta', `${s.origen} → ${s.destino}`),
      filaDato('Horario', `${fecha(s.inicio)} · ${s.horaInicio} – ${s.horaFinEstimada}`),
      filaDato('Distancia / carga', `${num(s.distanciaKm, ' km')} · ${num(s.pesoCargaKg, ' kg')}`),
      filaDato('Vehículo', s.vehiculo ? `${s.vehiculo.placa} · ${s.vehiculo.marca} ${s.vehiculo.modelo}` : 'Sin asignar'),
      s.recargaPlanificada ? filaDato('Recarga planificada', 'Sí') : null,
      s.factura ? filaDato('Factura', s.factura.codigo) : null,
      h('h3', { class: 'font-semibold mt-5 mb-2' }, 'Desglose de tarifa'),
      desglose(s.detalleCalculo),
      s.estado === 'PROGRAMADO' ? seccionAsignacion(s, tras) : null,
      acciones.length || s.estado === 'PROGRAMADO'
        ? h(
            'div',
            { class: 'flex flex-wrap gap-2 mt-5' },
            s.estado === 'PROGRAMADO'
              ? boton('Editar', {
                  icono: Pencil,
                  onClick: () => {
                    modal.cerrar();
                    void formulario(s);
                  },
                })
              : null,
            ...acciones.map((a) => boton(a.texto, { icono: a.icono, variante: a.variante, onClick: () => cambiarEstado(s, a.destino, tras) })),
          )
        : null,
      h('h3', { class: 'font-semibold mt-6 mb-2 flex items-center gap-2' }, icono(History, 'size-4'), 'Historial de estados'),
      h(
        'ol',
        { class: 'border-l-2 border-borde ml-2 flex flex-col gap-3' },
        ...historial.map((c) =>
          h(
            'li',
            { class: 'pl-4 relative' },
            h('span', { class: 'absolute -left-[7px] top-1.5 size-3 rounded-full bg-salvia border-2 border-superficie' }),
            h('div', { class: 'flex flex-wrap items-center gap-2' }, c.estadoAnterior ? [badgeEstadoServicio(c.estadoAnterior), '→'] : 'Creado como', badgeEstadoServicio(c.estadoNuevo)),
            h('p', { class: 'text-sm text-tinta-suave mt-1' }, `${fechaHora(c.fecha)} · ${c.usuarioNombre ?? 'Usuario'}`),
            c.observacion ? h('p', { class: 'text-sm' }, c.observacion) : null,
          ),
        ),
      ),
    );
  }

  function seccionAsignacion(s: Servicio, tras: () => Promise<void>): HTMLElement {
    const sel = campoSelect('Vehículo disponible', 'vehiculoId', [], 'Cargando vehículos…');
    const aviso = h('p', { class: 'text-sm', role: 'alert' });
    const asignar = boton(s.vehiculoId ? 'Reasignar' : 'Asignar vehículo', { variante: 'primario', icono: Truck });
    void vehiculosAsignables()
      .then((vs) => opciones(sel.control, vs.map((v) => ({ valor: v.id, texto: etiquetaVehiculo(v) })), 'Selecciona un vehículo', s.vehiculoId ?? undefined))
      .catch((err: Error) => (aviso.textContent = err.message));
    asignar.addEventListener('click', async () => {
      if (!sel.control.value) return sel.error('Selecciona un vehículo');
      sel.error(null);
      aviso.replaceChildren();
      try {
        await conCarga(asignar, () => serviciosApi.asignar(s.id, sel.control.value, s.version), 'Asignando…');
        toast('Vehículo asignado y tarifa calculada');
        await tras();
      } catch (err) {
        // 409 de concurrencia: mensaje específico y opción de actualizar
        if (err instanceof ApiError && err.esConflicto) {
          aviso.className = 'text-sm bg-rosa-polvo/60 rounded-app px-3 py-2 mt-2';
          aviso.replaceChildren(
            h('span', { class: 'block mb-2' }, MENSAJE_CONCURRENCIA),
            h('span', { class: 'block text-tinta-suave mb-2' }, err.message),
            boton('Actualizar', { icono: RefreshCw, onClick: () => void tras() }),
          );
        } else {
          aviso.className = 'text-sm text-error mt-2';
          aviso.textContent = (err as Error).message;
        }
      }
    });
    return h('div', { class: 'mt-5 bg-fondo rounded-app p-4' }, h('h3', { class: 'font-semibold mb-2' }, 'Asignación de vehículo'), sel.contenedor, asignar, aviso);
  }

  function cambiarEstado(s: Servicio, destino: EstadoServicio, tras: () => Promise<void>) {
    const textos: Partial<Record<EstadoServicio, [string, string]>> = {
      EN_EJECUCION: ['Iniciar servicio', `El vehículo ${s.vehiculo?.placa ?? ''} pasará a EN SERVICIO.`],
      COMPLETADO: ['Completar servicio', `Se sumarán ${num(s.distanciaKm)} km al kilometraje del vehículo (una sola vez).`],
      CANCELADO: ['Cancelar servicio', 'El servicio quedará CANCELADO y no podrá reactivarse.'],
    };
    const [titulo, mensaje] = textos[destino]!;
    const recarga = casilla('Recarga planificada en ruta', 'recarga', s.recargaPlanificada);
    const observacion = campoTexto('Observación (opcional)', 'observacion');
    const esFurgoneta = s.vehiculo?.tipo === 'FURGONETA_ELECTRICA' && destino === 'EN_EJECUCION';
    confirmar(
      titulo,
      h('div', { class: 'flex flex-col gap-3' }, h('p', null, mensaje), esFurgoneta ? recarga.contenedor : null, observacion.contenedor),
      titulo.split(' ')[0],
      async (modal, btn) => {
        try {
          await conCarga(btn, () =>
            serviciosApi.cambiarEstado(s.id, destino, {
              ...(esFurgoneta ? { recargaPlanificada: recarga.control.checked } : {}),
              ...(observacion.control.value.trim() ? { observacion: observacion.control.value.trim() } : {}),
            }),
          );
          toast(`${s.codigo}: ${ESTADO_SERVICIO[destino].texto.toLowerCase()}`);
          modal.cerrar();
          await tras();
        } catch (err) {
          toast((err as Error).message, 'error');
        }
      },
      destino === 'CANCELADO' ? 'peligro' : 'primario',
    );
  }

  reemplazar(
    contenedor,
    encabezado('Servicios de transporte', 'Programación, asignación y seguimiento', boton('Nuevo servicio', { variante: 'primario', icono: Plus, onClick: () => void formulario() })),
    h(
      'details',
      { class: 'tarjeta p-4 mb-4', open: window.matchMedia('(min-width: 768px)').matches },
      h('summary', { class: 'cursor-pointer font-medium min-h-11 flex items-center' }, 'Filtros y orden'),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 mt-3' },
        filtroEstado.contenedor,
        filtroCliente.contenedor,
        filtroTipo.contenedor,
        codigo.contenedor,
        desde.contenedor,
        hasta.contenedor,
        orden.contenedor,
      ),
    ),
    lista,
  );
  void recargar();
};

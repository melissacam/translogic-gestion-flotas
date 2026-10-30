import { Gauge, Pencil, Plus, Power, Search } from 'lucide';
import { ApiError } from '../api/http';
import { vehiculosApi } from '../api/vehiculos.api';
import { badgeEstadoVehiculo, badgeTipo, ESTADO_VEHICULO, TIPO_VEHICULO } from '../components/badge';
import { boton, conCarga } from '../components/button';
import { encabezado, filaDato } from '../components/card';
import { debounce, h, icono, reemplazar } from '../components/dom';
import { cargarEn, vacio } from '../components/estados';
import { campoNumero, campoTexto, type Campo } from '../components/input';
import { abrirModal, confirmar } from '../components/modal';
import { paginacion } from '../components/pagination';
import { campoSelect } from '../components/select';
import { tablaResponsive } from '../components/table';
import { toast } from '../components/toast';
import { num, pct, usd } from '../core/format';
import type { Pagina } from '../core/router';
import { session } from '../core/session';
import {
  ANIO_MAXIMO,
  enlazarValidacion,
  entero,
  noNegativo,
  normalizarPlaca,
  numeroEntre,
  patron,
  PLACA,
  positivo,
  requerido,
  type Regla,
} from '../core/validators';
import type { TipoVehiculo, Vehiculo } from '../types';

interface DefCampo {
  nombre: keyof Vehiculo;
  etiqueta: string;
  reglas: Regla[];
  tipo?: TipoVehiculo;
  entero?: boolean;
}

// Campos dinámicos: los de cada subtipo solo se muestran y validan si aplica
const CAMPOS: DefCampo[] = [
  { nombre: 'capacidadCargaKg', etiqueta: 'Capacidad de carga (kg)', reglas: [positivo()] },
  { nombre: 'kilometraje', etiqueta: 'Kilometraje', reglas: [noNegativo()] },
  { nombre: 'consumoLitros100Km', etiqueta: 'Consumo (L / 100 km)', reglas: [positivo()], tipo: 'CAMION_CARGA' },
  { nombre: 'precioLitro', etiqueta: 'Precio por litro (USD)', reglas: [positivo()], tipo: 'CAMION_CARGA' },
  { nombre: 'numeroEjes', etiqueta: 'Número de ejes', reglas: [numeroEntre(2, 10, 'Entre 2 y 10 ejes'), entero], tipo: 'CAMION_CARGA', entero: true },
  { nombre: 'costoMantenimientoKm', etiqueta: 'Mantenimiento por km (USD)', reglas: [positivo()], tipo: 'CAMION_CARGA' },
  { nombre: 'capacidadBateriaKWh', etiqueta: 'Capacidad de batería (kWh)', reglas: [positivo()], tipo: 'FURGONETA_ELECTRICA' },
  { nombre: 'consumoKWh100Km', etiqueta: 'Consumo (kWh / 100 km)', reglas: [positivo()], tipo: 'FURGONETA_ELECTRICA' },
  { nombre: 'costoKWh', etiqueta: 'Costo por kWh (USD)', reglas: [positivo()], tipo: 'FURGONETA_ELECTRICA' },
  { nombre: 'autonomiaKm', etiqueta: 'Autonomía nominal (km)', reglas: [positivo()], tipo: 'FURGONETA_ELECTRICA' },
  {
    nombre: 'porcentajeBateria',
    etiqueta: 'Batería actual (%)',
    reglas: [numeroEntre(0, 100, 'El porcentaje de batería debe estar entre 0 y 100')],
    tipo: 'FURGONETA_ELECTRICA',
  },
];
const CAMPOS_OPERADOR = new Set(['kilometraje', 'porcentajeBateria', 'estado']);

export const paginaVehiculos: Pagina = (contenedor) => {
  const esAdmin = session.esAdmin();
  const estado = { page: 1 };
  const busqueda = campoTexto('Buscar por placa', 'placa', { placeholder: 'Ej. GBA-1021' });
  busqueda.contenedor.querySelector('label')?.prepend(icono(Search, 'inline size-4 mr-1'));
  const tipo = campoSelect('Tipo', 'tipo', Object.entries(TIPO_VEHICULO).map(([valor, e]) => ({ valor, texto: e.texto })), 'Todos');
  const est = campoSelect('Estado', 'estado', Object.entries(ESTADO_VEHICULO).map(([valor, e]) => ({ valor, texto: e.texto })), 'Todos');
  const lista = h('div');

  const recargar = () =>
    cargarEn(
      lista,
      () =>
        vehiculosApi.listar({
          page: estado.page,
          limit: 10,
          placa: busqueda.control.value.trim() || undefined,
          tipo: tipo.control.value || undefined,
          estado: est.control.value || undefined,
        }),
      (r) => {
        if (r.total === 0) {
          reemplazar(lista, vacio('No hay vehículos con esos filtros', 'Prueba con otra placa o quita los filtros de tipo y estado.'));
          return;
        }
        reemplazar(
          lista,
          tablaResponsive(
            r.data,
            [
              { titulo: 'Placa', celda: (v) => h('span', { class: 'font-semibold' }, v.placa), principal: true },
              { titulo: 'Tipo', celda: (v) => badgeTipo(v.tipo) },
              { titulo: 'Marca / modelo', celda: (v) => `${v.marca} ${v.modelo}`, ocultarEnMovil: true },
              { titulo: 'Estado', celda: (v) => badgeEstadoVehiculo(v.estado) },
              { titulo: 'Capacidad', celda: (v) => num(v.capacidadCargaKg, ' kg'), alineacion: 'derecha' },
              { titulo: 'Kilometraje', celda: (v) => num(v.kilometraje, ' km'), alineacion: 'derecha' },
              {
                titulo: 'Autonomía disp.',
                celda: (v) => (v.autonomiaDisponibleKm ? `${num(v.autonomiaDisponibleKm)} km (${v.porcentajeBateria} %)` : '—'),
                alineacion: 'derecha',
              },
            ],
            {
              alSeleccionar: (v) => void verEficiencia(v),
              acciones: (v) => [
                boton('Editar', { icono: Pencil, onClick: () => formulario(v) }),
                esAdmin && v.estado !== 'INACTIVO' ? boton('Desactivar', { icono: Power, variante: 'peligro', onClick: () => desactivar(v) }) : null,
              ],
            },
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
  // Búsqueda por placa con debounce de 300 ms
  busqueda.control.addEventListener('input', debounce(filtrar, 300));
  [tipo, est].forEach((c) => c.control.addEventListener('change', filtrar));

  function formulario(v?: Vehiculo) {
    const edicion = Boolean(v);
    const soloOperador = edicion && !esAdmin;
    const modal = abrirModal(edicion ? `Editar ${v!.placa}` : 'Nuevo vehículo');
    const tipoSel = campoSelect('Tipo de vehículo', 'tipo', Object.entries(TIPO_VEHICULO).map(([valor, e]) => ({ valor, texto: e.texto })), undefined, v?.tipo ?? 'CAMION_CARGA');
    tipoSel.control.disabled = edicion;
    const placa = campoTexto('Placa', 'placa', { valor: v?.placa, placeholder: 'GBA-1234' });
    const marca = campoTexto('Marca', 'marca', { valor: v?.marca });
    const modelo = campoTexto('Modelo', 'modelo', { valor: v?.modelo });
    const anio = campoNumero('Año', 'anio', { valor: v?.anio, inputmode: 'numeric', min: 1990, max: ANIO_MAXIMO });
    const estadoSel = campoSelect(
      'Estado',
      'estado',
      [
        { valor: 'DISPONIBLE', texto: 'Disponible' },
        { valor: 'MANTENIMIENTO', texto: 'Mantenimiento' },
      ],
      undefined,
      v?.estado === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'DISPONIBLE',
    );
    placa.control.addEventListener('input', () => (placa.control.value = normalizarPlaca(placa.control.value)));

    const dinamicos = new Map<string, { def: DefCampo; campo: Campo }>();
    for (const def of CAMPOS) {
      const valor = v ? (v[def.nombre] as string | number | undefined) : undefined;
      dinamicos.set(def.nombre, { def, campo: campoNumero(def.etiqueta, def.nombre, { valor: valor ?? '', inputmode: def.entero ? 'numeric' : 'decimal' }) });
    }
    const visible = (def: DefCampo) => (!def.tipo || def.tipo === tipoSel.control.value) && (!soloOperador || CAMPOS_OPERADOR.has(def.nombre));
    const actualizarVisibles = () => dinamicos.forEach(({ def, campo }) => campo.contenedor.classList.toggle('hidden', !visible(def)));
    tipoSel.control.addEventListener('change', actualizarVisibles);
    actualizarVisibles();

    const basicos = [
      { campo: placa, reglas: [requerido(), patron(PLACA, 'Placa inválida (formato ABC-1234)')] },
      { campo: marca, reglas: [requerido()] },
      { campo: modelo, reglas: [requerido()] },
      { campo: anio, reglas: [numeroEntre(1990, ANIO_MAXIMO, `Entre 1990 y ${ANIO_MAXIMO}`), entero] },
    ];
    const valido = enlazarValidacion([
      ...basicos.map((b) => ({ control: b.campo.control, error: b.campo.error, reglas: b.reglas, activo: () => !soloOperador })),
      ...[...dinamicos.values()].map(({ def, campo }) => ({ control: campo.control, error: campo.error, reglas: def.reglas, activo: () => visible(def) })),
    ]);

    const guardar = boton(edicion ? 'Guardar cambios' : 'Crear vehículo', { variante: 'primario' });
    const form = h(
      'form',
      {
        class: 'grid grid-cols-1 md:grid-cols-2 gap-x-4',
        novalidate: true,
        onSubmit: async (e: SubmitEvent) => {
          e.preventDefault();
          if (!valido()) return;
          const datos: Record<string, unknown> = {};
          if (!soloOperador) {
            if (!edicion) datos.tipo = tipoSel.control.value;
            datos.placa = placa.control.value.trim();
            datos.marca = marca.control.value.trim();
            datos.modelo = modelo.control.value.trim();
            datos.anio = Number(anio.control.value);
          }
          dinamicos.forEach(({ def, campo }) => {
            if (visible(def) && campo.control.value !== '') datos[def.nombre] = Number(campo.control.value);
          });
          if (edicion && v!.estado !== 'EN_SERVICIO') datos.estado = estadoSel.control.value;
          try {
            await conCarga(guardar, () => (edicion ? vehiculosApi.actualizar(v!.id, datos) : vehiculosApi.crear(datos)), 'Guardando…');
            toast(edicion ? 'Vehículo actualizado' : 'Vehículo creado');
            modal.cerrar();
            void recargar();
          } catch (err) {
            toast(err instanceof ApiError && err.esConflicto ? 'Ya existe un vehículo con esa placa.' : (err as Error).message, 'error');
          }
        },
      },
      soloOperador ? h('p', { class: 'md:col-span-2 text-sm text-tinta-suave mb-3' }, 'Como operador puedes actualizar kilometraje, batería y estado.') : null,
      soloOperador ? null : [tipoSel.contenedor, placa.contenedor, marca.contenedor, modelo.contenedor, anio.contenedor],
      [...dinamicos.values()].map(({ campo }) => campo.contenedor),
      edicion && v!.estado !== 'EN_SERVICIO' ? estadoSel.contenedor : null,
    );
    modal.cuerpo.append(form);
    modal.pie.append(boton('Cancelar', { onClick: () => modal.cerrar() }), guardar);
    guardar.addEventListener('click', () => form.requestSubmit());
  }

  function desactivar(v: Vehiculo) {
    confirmar(
      'Desactivar vehículo',
      `El vehículo ${v.placa} pasará a INACTIVO (borrado lógico) y no podrá recibir servicios. Su historial se conserva.`,
      'Desactivar',
      async (modal, btn) => {
        try {
          await conCarga(btn, () => vehiculosApi.desactivar(v.id));
          toast(`${v.placa} desactivado`);
          modal.cerrar();
          void recargar();
        } catch (err) {
          toast((err as Error).message, 'error');
        }
      },
      'peligro',
    );
  }

  async function verEficiencia(v: Vehiculo) {
    const modal = abrirModal(`${v.placa} · eficiencia`, { lateral: true });
    await cargarEn(
      modal.cuerpo,
      () => vehiculosApi.eficiencia(v.id),
      (e) =>
        reemplazar(
          modal.cuerpo,
          h('div', { class: 'flex flex-wrap gap-2 mb-4' }, badgeTipo(v.tipo), badgeEstadoVehiculo(v.estado)),
          h('p', { class: 'text-sm text-tinta-suave mb-3' }, `${v.marca} ${v.modelo} · ${v.anio} · ${num(v.kilometraje, ' km')}`),
          h(
            'div',
            { class: `rounded-app px-3 py-2 mb-4 text-sm ${e.clasificacion === 'SOBRE_PROMEDIO' ? 'bg-salvia/50' : 'bg-mantequilla'}` },
            icono(Gauge, 'inline size-4 mr-1'),
            e.clasificacion === 'SOBRE_PROMEDIO' ? 'Sobre el promedio de su categoría' : 'Bajo el promedio de su categoría',
          ),
          filaDato('Servicios completados', String(e.serviciosCompletados)),
          filaDato('Km recorridos', num(e.kmRecorridos, ' km')),
          filaDato('Costo operativo total', usd(e.costoOperativoTotal)),
          filaDato('Ingresos totales', usd(e.ingresosTotales)),
          filaDato('Costo por km', usd(e.costoPorKm)),
          filaDato('Eficiencia (km por USD)', num(e.eficienciaKmPorUsd)),
          filaDato('Promedio de la categoría', num(e.promedioCategoria)),
          v.tipo === 'FURGONETA_ELECTRICA'
            ? [
                filaDato('Batería actual', pct(v.porcentajeBateria)),
                filaDato('Autonomía disponible', num(e.autonomiaDisponibleKm, ' km'), true),
              ]
            : null,
        ),
    );
  }

  reemplazar(
    contenedor,
    encabezado('Vehículos', 'Camiones de carga y furgonetas eléctricas de la flota', esAdmin ? boton('Nuevo vehículo', { variante: 'primario', icono: Plus, onClick: () => formulario() }) : null),
    h('div', { class: 'tarjeta p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-x-3' }, busqueda.contenedor, tipo.contenedor, est.contenedor),
    lista,
  );
  void recargar();
};

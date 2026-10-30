import { Pencil, Plus, Trash2 } from 'lucide';
import { clientesApi } from '../api/clientes.api';
import { ApiError } from '../api/http';
import { boton, conCarga } from '../components/button';
import { encabezado } from '../components/card';
import { debounce, h, reemplazar } from '../components/dom';
import { cargarEn, vacio } from '../components/estados';
import { campoTexto } from '../components/input';
import { abrirModal, confirmar } from '../components/modal';
import { paginacion } from '../components/pagination';
import { tablaResponsive } from '../components/table';
import { toast } from '../components/toast';
import type { Pagina } from '../core/router';
import { session } from '../core/session';
import { correo, enlazarValidacion, IDENTIFICACION, minimoLargo, patron, requerido, TELEFONO } from '../core/validators';
import type { Cliente } from '../types';

export const paginaClientes: Pagina = (contenedor) => {
  const esAdmin = session.esAdmin();
  const estado = { page: 1 };
  const busqueda = campoTexto('Buscar', 'q', { placeholder: 'Nombre o identificación' });
  const lista = h('div');

  const recargar = () =>
    cargarEn(
      lista,
      () => clientesApi.listar({ page: estado.page, limit: 10, q: busqueda.control.value.trim() || undefined }),
      (r) => {
        if (r.total === 0) {
          reemplazar(
            lista,
            vacio(
              'Aún no hay clientes que coincidan',
              'Registra un cliente para poder programar servicios a su nombre.',
              boton('Nuevo cliente', { variante: 'primario', icono: Plus, onClick: () => formulario() }),
            ),
          );
          return;
        }
        reemplazar(
          lista,
          tablaResponsive(
            r.data,
            [
              { titulo: 'Nombre', celda: (c) => c.nombre, principal: true },
              { titulo: 'Identificación', celda: (c) => c.identificacion },
              { titulo: 'Correo', celda: (c) => c.correo },
              { titulo: 'Teléfono', celda: (c) => c.telefono },
            ],
            esAdmin
              ? {
                  acciones: (c) => [
                    boton('Editar', { icono: Pencil, onClick: () => formulario(c) }),
                    boton('Eliminar', { icono: Trash2, variante: 'peligro', onClick: () => eliminar(c) }),
                  ],
                }
              : {},
          ),
          paginacion(r.page, r.totalPages, r.total, (p) => {
            estado.page = p;
            void recargar();
          }),
        );
      },
    );

  busqueda.control.addEventListener(
    'input',
    debounce(() => {
      estado.page = 1;
      void recargar();
    }, 300),
  );

  function formulario(c?: Cliente) {
    const modal = abrirModal(c ? `Editar ${c.nombre}` : 'Nuevo cliente');
    const identificacion = campoTexto('Cédula o RUC', 'identificacion', { valor: c?.identificacion, inputmode: 'numeric', ayuda: '10 dígitos (cédula) o 13 (RUC)' });
    const nombre = campoTexto('Nombre o razón social', 'nombre', { valor: c?.nombre });
    const email = campoTexto('Correo', 'correo', { valor: c?.correo, tipo: 'email', inputmode: 'email' });
    const telefono = campoTexto('Teléfono', 'telefono', { valor: c?.telefono, inputmode: 'tel', tipo: 'tel' });
    const direccion = campoTexto('Dirección (opcional)', 'direccion', { valor: c?.direccion });
    const valido = enlazarValidacion([
      { ...identificacion, reglas: [requerido(), patron(IDENTIFICACION, 'Debe tener 10 (cédula) o 13 dígitos (RUC)')] },
      { ...nombre, reglas: [requerido(), minimoLargo(3, 'Mínimo 3 caracteres')] },
      { ...email, reglas: [requerido(), correo] },
      { ...telefono, reglas: [requerido(), patron(TELEFONO, 'El teléfono debe tener 10 dígitos')] },
    ]);
    const guardar = boton(c ? 'Guardar cambios' : 'Crear cliente', { variante: 'primario' });
    const form = h(
      'form',
      {
        class: 'grid grid-cols-1 md:grid-cols-2 gap-x-4',
        novalidate: true,
        onSubmit: async (e: SubmitEvent) => {
          e.preventDefault();
          if (!valido()) return;
          const datos = {
            identificacion: identificacion.control.value.trim(),
            nombre: nombre.control.value.trim(),
            correo: email.control.value.trim(),
            telefono: telefono.control.value.trim(),
            ...(direccion.control.value.trim() ? { direccion: direccion.control.value.trim() } : {}),
          };
          try {
            await conCarga(guardar, () => (c ? clientesApi.actualizar(c.id, datos) : clientesApi.crear(datos)), 'Guardando…');
            toast(c ? 'Cliente actualizado' : 'Cliente registrado');
            modal.cerrar();
            void recargar();
          } catch (err) {
            if (err instanceof ApiError && err.esConflicto) identificacion.error('Ya existe un cliente con esa identificación');
            else toast((err as Error).message, 'error');
          }
        },
      },
      identificacion.contenedor,
      nombre.contenedor,
      email.contenedor,
      telefono.contenedor,
      h('div', { class: 'md:col-span-2' }, direccion.contenedor),
    );
    guardar.addEventListener('click', () => form.requestSubmit());
    modal.cuerpo.append(form);
    modal.pie.append(boton('Cancelar', { onClick: () => modal.cerrar() }), guardar);
  }

  function eliminar(c: Cliente) {
    confirmar(
      'Eliminar cliente',
      `¿Eliminar a ${c.nombre}? Solo es posible si no tiene servicios registrados.`,
      'Eliminar',
      async (modal, btn) => {
        try {
          await conCarga(btn, () => clientesApi.eliminar(c.id));
          toast('Cliente eliminado');
          modal.cerrar();
          void recargar();
        } catch (err) {
          toast((err as Error).message, 'error');
        }
      },
      'peligro',
    );
  }

  reemplazar(
    contenedor,
    encabezado('Clientes', 'Empresas y personas que contratan servicios de transporte', boton('Nuevo cliente', { variante: 'primario', icono: Plus, onClick: () => formulario() })),
    h('div', { class: 'tarjeta p-4 mb-4' }, busqueda.contenedor),
    lista,
  );
  void recargar();
};

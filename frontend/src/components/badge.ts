import { Ban, CalendarClock, CircleCheck, Leaf, Play, Power, Truck, Wrench, Zap } from 'lucide';
import type { IconNode } from 'lucide';
import type { EstadoServicio, EstadoVehiculo, TipoVehiculo } from '../types';
import { h, icono } from './dom';

interface Estilo {
  fondo: string;
  texto: string;
  icono: IconNode;
}

// Significado fijo del color en toda la app; siempre acompañado de texto e ícono
export const ESTADO_SERVICIO: Record<EstadoServicio, Estilo> = {
  PROGRAMADO: { fondo: 'bg-pervinca', texto: 'Programado', icono: CalendarClock },
  EN_EJECUCION: { fondo: 'bg-mantequilla', texto: 'En ejecución', icono: Play },
  COMPLETADO: { fondo: 'bg-salvia', texto: 'Completado', icono: CircleCheck },
  CANCELADO: { fondo: 'bg-rosa-polvo', texto: 'Cancelado', icono: Ban },
};

export const TIPO_VEHICULO: Record<TipoVehiculo, Estilo> = {
  CAMION_CARGA: { fondo: 'bg-melocoton', texto: 'Camión de carga', icono: Truck },
  FURGONETA_ELECTRICA: { fondo: 'bg-menta-cielo', texto: 'Furgoneta eléctrica', icono: Zap },
};

export const ESTADO_VEHICULO: Record<EstadoVehiculo, Estilo> = {
  DISPONIBLE: { fondo: 'bg-salvia', texto: 'Disponible', icono: Leaf },
  EN_SERVICIO: { fondo: 'bg-mantequilla', texto: 'En servicio', icono: Play },
  MANTENIMIENTO: { fondo: 'bg-pervinca', texto: 'Mantenimiento', icono: Wrench },
  INACTIVO: { fondo: 'bg-rosa-polvo', texto: 'Inactivo', icono: Power },
};

function insignia(e: Estilo): HTMLSpanElement {
  return h('span', { class: `insignia ${e.fondo}` }, icono(e.icono, 'size-4'), e.texto);
}

export const badgeEstadoServicio = (estado: EstadoServicio) => insignia(ESTADO_SERVICIO[estado]);
export const badgeTipo = (tipo: TipoVehiculo) => insignia(TIPO_VEHICULO[tipo]);
export const badgeEstadoVehiculo = (estado: EstadoVehiculo) => insignia(ESTADO_VEHICULO[estado]);

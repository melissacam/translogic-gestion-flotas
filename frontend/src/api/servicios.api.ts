import type { CambioEstado, EstadoServicio, Paginado, Servicio, SimulacionTarifa } from '../types';
import { http } from './http';
import type { Filtros } from './http';

export const serviciosApi = {
  listar: (f: Filtros) => http.get<Paginado<Servicio>>('/servicios', f),
  obtener: (id: string) => http.get<Servicio>(`/servicios/${id}`),
  crear: (datos: Record<string, unknown>) => http.post<Servicio>('/servicios', datos),
  actualizar: (id: string, datos: Record<string, unknown>) => http.patch<Servicio>(`/servicios/${id}`, datos),
  asignar: (id: string, vehiculoId: string, version: number) =>
    http.patch<Servicio>(`/servicios/${id}/asignacion`, { vehiculoId, version }),
  cambiarEstado: (id: string, estado: EstadoServicio, extra: Record<string, unknown> = {}) =>
    http.patch<Servicio>(`/servicios/${id}/estado`, { estado, ...extra }),
  historial: (id: string) => http.get<CambioEstado[]>(`/servicios/${id}/historial`),
  simularTarifa: (datos: Record<string, unknown>) => http.post<SimulacionTarifa>('/servicios/simular-tarifa', datos),
};

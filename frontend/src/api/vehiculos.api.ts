import type { Eficiencia, Paginado, Vehiculo } from '../types';
import { http } from './http';
import type { Filtros } from './http';

export const vehiculosApi = {
  listar: (f: Filtros) => http.get<Paginado<Vehiculo>>('/vehiculos', f),
  obtener: (id: string) => http.get<Vehiculo>(`/vehiculos/${id}`),
  crear: (datos: Record<string, unknown>) => http.post<Vehiculo>('/vehiculos', datos),
  actualizar: (id: string, datos: Record<string, unknown>) => http.patch<Vehiculo>(`/vehiculos/${id}`, datos),
  desactivar: (id: string) => http.delete<Vehiculo>(`/vehiculos/${id}`),
  eficiencia: (id: string) => http.get<Eficiencia>(`/vehiculos/${id}/eficiencia`),
};

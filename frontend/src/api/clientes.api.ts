import type { Cliente, Paginado } from '../types';
import { http } from './http';
import type { Filtros } from './http';

export const clientesApi = {
  listar: (f: Filtros) => http.get<Paginado<Cliente>>('/clientes', f),
  crear: (datos: Record<string, unknown>) => http.post<Cliente>('/clientes', datos),
  actualizar: (id: string, datos: Record<string, unknown>) => http.patch<Cliente>(`/clientes/${id}`, datos),
  eliminar: (id: string) => http.delete<{ eliminado: boolean }>(`/clientes/${id}`),
};

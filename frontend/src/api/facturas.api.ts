import type { Factura, Paginado, SimulacionFactura } from '../types';
import { http } from './http';
import type { Filtros } from './http';

export const facturasApi = {
  listar: (f: Filtros) => http.get<Paginado<Factura>>('/facturas', f),
  obtener: (id: string) => http.get<Factura>(`/facturas/${id}`),
  simular: (datos: Record<string, unknown>) => http.post<SimulacionFactura>('/facturas/simular', datos),
  crear: (datos: Record<string, unknown>) => http.post<Factura>('/facturas', datos),
  pdf: (id: string) => http.blob(`/facturas/${id}/pdf`),
};

import type { Rentabilidad, ResultadoConsulta } from '../types';
import { http } from './http';
import type { Filtros } from './http';

export const reportesApi = {
  rentabilidad: (f: Filtros) => http.get<Rentabilidad>('/reportes/rentabilidad', f),
  operaciones: (f: Filtros) => http.get<ResultadoConsulta>('/reportes/operaciones', f),
};

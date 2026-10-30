// Interfaces que reflejan las respuestas de la API (importes siempre como string)
export type Rol = 'ADMINISTRADOR' | 'OPERADOR';
export type TipoVehiculo = 'CAMION_CARGA' | 'FURGONETA_ELECTRICA';
export type EstadoVehiculo = 'DISPONIBLE' | 'EN_SERVICIO' | 'MANTENIMIENTO' | 'INACTIVO';
export type EstadoServicio = 'PROGRAMADO' | 'EN_EJECUCION' | 'COMPLETADO' | 'CANCELADO';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Cliente {
  id: string;
  identificacion: string;
  nombre: string;
  correo: string;
  telefono: string;
  direccion?: string;
}

export interface Vehiculo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  capacidadCargaKg: number;
  kilometraje: number;
  tipo: TipoVehiculo;
  estado: EstadoVehiculo;
  version: number;
  consumoLitros100Km?: number;
  precioLitro?: string;
  numeroEjes?: number;
  costoMantenimientoKm?: string;
  capacidadBateriaKWh?: number;
  consumoKWh100Km?: number;
  costoKWh?: string;
  autonomiaKm?: number;
  porcentajeBateria?: number;
  autonomiaDisponibleKm?: string;
}

export interface Eficiencia {
  placa: string;
  tipo: TipoVehiculo;
  serviciosCompletados: number;
  kmRecorridos: number;
  costoOperativoTotal: string;
  ingresosTotales: string;
  eficienciaKmPorUsd: string;
  costoPorKm: string;
  promedioCategoria: string;
  clasificacion: 'SOBRE_PROMEDIO' | 'BAJO_PROMEDIO';
  autonomiaDisponibleKm?: string;
}

export interface DesgloseTarifa {
  tipo: TipoVehiculo;
  costoCombustible: string | null;
  costoEnergetico: string | null;
  costoMantenimiento: string;
  costoOperativo: string;
  tarifaBase: string;
  ajustePorcentaje: number;
  motivoAjuste: string | null;
  tarifa: string;
  autonomiaDisponibleKm: string | null;
  recargoPorcentaje: number;
  motivosRecargo: string[];
  recargos: string;
  importe: string;
}

export interface SimulacionTarifa extends DesgloseTarifa {
  vehiculo: { id: string; placa: string; tipo: TipoVehiculo };
  advertencias: string[];
}

export interface Servicio {
  id: string;
  codigo: string;
  clienteId: string;
  vehiculoId: string | null;
  origen: string;
  destino: string;
  distanciaKm: number;
  pesoCargaKg: number;
  fecha: string;
  horaInicio: string;
  horaFinEstimada: string;
  inicio: string;
  finEstimada: string;
  estado: EstadoServicio;
  recargaPlanificada: boolean;
  costoOperativo: string | null;
  tarifa: string | null;
  recargos: string | null;
  importe: string | null;
  detalleCalculo?: DesgloseTarifa | null;
  facturaId: string | null;
  version: number;
  cliente?: { id: string; nombre: string; identificacion: string };
  vehiculo?: { id: string; placa: string; tipo: TipoVehiculo; marca: string; modelo: string; estado?: EstadoVehiculo };
  factura?: { id: string; codigo: string };
}

export interface CambioEstado {
  id: string;
  estadoAnterior: EstadoServicio | null;
  estadoNuevo: EstadoServicio;
  fecha: string;
  usuarioNombre?: string;
  usuarioRol?: Rol;
  observacion?: string;
}

export interface LineaFactura {
  servicioId: string;
  codigo: string;
  distanciaKm: number;
  inicio: string;
  tarifa: string;
  porcentajeRecargo: number;
  motivosRecargo: string[];
  recargos: string;
  importe: string;
}

export interface ResumenFactura {
  subtotal: string;
  recargos: string;
  base: string;
  serviciosCompletadosMes: number;
  porcentajeDescuento: number;
  descuento: string;
  baseImponible: string;
  tasaImpuesto: number;
  impuesto: string;
  total: string;
}

export interface SimulacionFactura extends ResumenFactura {
  fecha: string;
  periodo: string;
  lineas: LineaFactura[];
}

export interface DetalleFactura {
  id: string;
  codigoServicio: string;
  tarifa: string;
  porcentajeRecargo: number;
  recargos: string;
  importe: string;
  servicio?: { origen: string; destino: string; distanciaKm: number; inicio: string };
}

export interface Factura extends ResumenFactura {
  id: string;
  codigo: string;
  clienteId: string;
  fecha: string;
  periodo: string;
  cantidadServicios: number;
  cliente?: Cliente;
  detalles?: DetalleFactura[];
}

export interface Rentabilidad {
  kpis: { ingresos: string; costos: string; utilidad: string; margen: string | number; servicios: number };
  serviciosPorEstado: { estado: EstadoServicio; cantidad: number }[];
  distribucionPorTipo: { tipo: TipoVehiculo; servicios: number; ingresos: string; costos: string }[];
  comparacionMensual: { mes: number; ingresos: string; costos: string; utilidad: string }[];
  porVehiculo: {
    vehiculoId: string;
    placa: string;
    tipo: TipoVehiculo;
    servicios: number;
    kmRecorridos: number;
    ingresos: string;
    costos: string;
    utilidad: string;
    margen: string | number;
  }[];
}

export interface ResultadoConsulta {
  consulta: number;
  descripcion: string;
  parametros: { desde: string; hasta: string; mes: string };
  total: number;
  resultados: Record<string, unknown>[];
}

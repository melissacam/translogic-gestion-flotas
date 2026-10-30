import { TipoVehiculo } from '../../common/enums';
import { Dec } from '../../common/utils/decimal.util';

type Numerico = number | string | { toString(): string };

// Datos mínimos del vehículo que necesitan las estrategias (doc Mongoose o lean)
export interface VehiculoTarifable {
  tipo: TipoVehiculo;
  capacidadCargaKg: number;
  consumoLitros100Km?: number;
  precioLitro?: Numerico;
  costoMantenimientoKm?: Numerico;
  capacidadBateriaKWh?: number;
  consumoKWh100Km?: number;
  costoKWh?: Numerico;
  autonomiaKm?: number;
  porcentajeBateria?: number;
}

export interface ResultadoTarifa {
  tipo: TipoVehiculo;
  costoCombustible?: Dec;
  costoEnergetico?: Dec;
  costoMantenimiento: Dec;
  costoOperativo: Dec;
  tarifaBase: Dec;
  ajustePorcentaje: Dec;
  motivoAjuste: string | null;
  tarifa: Dec;
  autonomiaDisponibleKm?: Dec;
}

export interface EstrategiaTarifa {
  readonly tipo: TipoVehiculo;
  calcular(
    vehiculo: VehiculoTarifable,
    distanciaKm: number,
    pesoCargaKg: number,
  ): ResultadoTarifa;
}

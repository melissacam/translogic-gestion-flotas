import { Dec, dec, redondear } from '../common/utils/decimal.util';
import { esDomingo } from '../common/utils/fecha.util';

export const UMBRAL_DISTANCIA_LARGA_KM = 300;
export const RECARGO_DISTANCIA_LARGA = dec('0.06');
export const RECARGO_DOMINGO = dec('0.12');

export interface ResultadoRecargo {
  porcentaje: Dec;
  motivos: string[];
  recargo: Dec;
}

// Recargos de facturación acumulables: +6 % si > 300 km y +12 % si fue en domingo
export function calcularRecargo(
  tarifa: Dec,
  distanciaKm: number,
  inicio: Date,
  zona: string,
): ResultadoRecargo {
  let porcentaje = dec(0);
  const motivos: string[] = [];
  if (distanciaKm > UMBRAL_DISTANCIA_LARGA_KM) {
    porcentaje = porcentaje.plus(RECARGO_DISTANCIA_LARGA);
    motivos.push('Distancia mayor a 300 km (+6 %)');
  }
  if (esDomingo(inicio, zona)) {
    porcentaje = porcentaje.plus(RECARGO_DOMINGO);
    motivos.push('Servicio en domingo (+12 %)');
  }
  return {
    porcentaje: porcentaje.mul(100),
    motivos,
    recargo: redondear(tarifa.mul(porcentaje)),
  };
}

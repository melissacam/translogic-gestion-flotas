import { Injectable } from '@nestjs/common';
import { TipoVehiculo } from '../../common/enums';
import { Dec, dec, redondear } from '../../common/utils/decimal.util';
import {
  EstrategiaTarifa,
  ResultadoTarifa,
  VehiculoTarifable,
} from './estrategia-tarifa.interface';
import {
  validarEntradaTarifa,
  validarPorcentajeBateria,
} from './validaciones-tarifa';

// USD 18: costo fijo operativo de la furgoneta (ver DECISIONES.md, punto 2)
export const COSTO_FIJO_FURGONETA = dec(18);
export const MARGEN_FURGONETA = dec('1.30');
export const RECARGO_AUTONOMIA = dec('0.10');
export const UMBRAL_AUTONOMIA = dec('0.80');

// Autonomía disponible = (capacidad kWh × % batería / 100) / consumo kWh por 100 km × 100
export function autonomiaDisponible(v: VehiculoTarifable): Dec {
  validarPorcentajeBateria(v.porcentajeBateria);
  const energiaKWh = dec(v.capacidadBateriaKWh)
    .mul(dec(v.porcentajeBateria))
    .div(100);
  return energiaKWh.div(dec(v.consumoKWh100Km)).mul(100);
}

@Injectable()
export class TarifaFurgonetaStrategy implements EstrategiaTarifa {
  readonly tipo = TipoVehiculo.FURGONETA_ELECTRICA;

  calcular(
    v: VehiculoTarifable,
    distanciaKm: number,
    pesoCargaKg: number,
  ): ResultadoTarifa {
    validarEntradaTarifa(v, distanciaKm, pesoCargaKg);
    const autonomia = autonomiaDisponible(v);
    const d = dec(distanciaKm);
    // costoEnergetico = (distancia / 100) × consumo kWh/100 km × costo kWh
    const costoEnergetico = d
      .div(100)
      .mul(dec(v.consumoKWh100Km))
      .mul(dec(v.costoKWh));
    const costoOperativo = costoEnergetico.plus(COSTO_FIJO_FURGONETA);
    const tarifaBase = costoOperativo.mul(MARGEN_FURGONETA);

    // Regla Req-02: distancia > 80 % de la autonomía nominal → +10 % a la tarifa base
    const rutaLarga = d.gt(dec(v.autonomiaKm).mul(UMBRAL_AUTONOMIA));
    const ajuste = rutaLarga ? RECARGO_AUTONOMIA : dec(0);
    const tarifa = tarifaBase.mul(dec(1).plus(ajuste));

    return {
      tipo: this.tipo,
      costoEnergetico: redondear(costoEnergetico),
      costoMantenimiento: redondear(COSTO_FIJO_FURGONETA),
      costoOperativo: redondear(costoOperativo),
      tarifaBase: redondear(tarifaBase),
      ajustePorcentaje: ajuste.mul(100),
      motivoAjuste: rutaLarga
        ? 'Distancia superior al 80 % de la autonomía (+10 %)'
        : null,
      tarifa: redondear(tarifa),
      autonomiaDisponibleKm: redondear(autonomia),
    };
  }
}

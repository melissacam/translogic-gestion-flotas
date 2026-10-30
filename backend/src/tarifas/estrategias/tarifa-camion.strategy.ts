import { Injectable } from '@nestjs/common';
import { TipoVehiculo } from '../../common/enums';
import { dec, redondear } from '../../common/utils/decimal.util';
import {
  EstrategiaTarifa,
  ResultadoTarifa,
  VehiculoTarifable,
} from './estrategia-tarifa.interface';
import { validarEntradaTarifa } from './validaciones-tarifa';

export const MARGEN_CAMION = dec('1.35');
export const RECARGO_CARGA_ALTA = dec('0.08');
export const UMBRAL_CARGA = dec('0.80');

@Injectable()
export class TarifaCamionStrategy implements EstrategiaTarifa {
  readonly tipo = TipoVehiculo.CAMION_CARGA;

  calcular(
    v: VehiculoTarifable,
    distanciaKm: number,
    pesoCargaKg: number,
  ): ResultadoTarifa {
    validarEntradaTarifa(v, distanciaKm, pesoCargaKg);
    const d = dec(distanciaKm);
    // costoCombustible = (distancia / 100) × consumo L/100 km × precio por litro
    const costoCombustible = d
      .div(100)
      .mul(dec(v.consumoLitros100Km))
      .mul(dec(v.precioLitro));
    const costoMantenimiento = d.mul(dec(v.costoMantenimientoKm));
    const costoOperativo = costoCombustible.plus(costoMantenimiento);
    const tarifaBase = costoOperativo.mul(MARGEN_CAMION);

    // Regla Req-02: si la carga supera el 80 % de la capacidad, +8 % a la tarifa base
    const cargaAlta = dec(pesoCargaKg).gt(
      dec(v.capacidadCargaKg).mul(UMBRAL_CARGA),
    );
    const ajuste = cargaAlta ? RECARGO_CARGA_ALTA : dec(0);
    const tarifa = tarifaBase.mul(dec(1).plus(ajuste));

    return {
      tipo: this.tipo,
      costoCombustible: redondear(costoCombustible),
      costoMantenimiento: redondear(costoMantenimiento),
      costoOperativo: redondear(costoOperativo),
      tarifaBase: redondear(tarifaBase),
      ajustePorcentaje: ajuste.mul(100),
      motivoAjuste: cargaAlta
        ? 'Carga superior al 80 % de la capacidad (+8 %)'
        : null,
      tarifa: redondear(tarifa),
    };
  }
}

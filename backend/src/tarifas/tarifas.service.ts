import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redondear } from '../common/utils/decimal.util';
import {
  ResultadoTarifa,
  VehiculoTarifable,
} from './estrategias/estrategia-tarifa.interface';
import { autonomiaDisponible } from './estrategias/tarifa-furgoneta.strategy';
import { calcularRecargo, ResultadoRecargo } from './recargos';
import { TarifaFactory } from './tarifa.factory';

export interface CalculoCompleto {
  tarifa: ResultadoTarifa;
  recargo: ResultadoRecargo;
  importe: ResultadoTarifa['tarifa'];
}

@Injectable()
export class TarifasService {
  constructor(
    private readonly factory: TarifaFactory,
    private readonly config: ConfigService,
  ) {}

  calcular(
    vehiculo: VehiculoTarifable,
    distanciaKm: number,
    pesoCargaKg: number,
  ): ResultadoTarifa {
    return this.factory
      .obtener(vehiculo.tipo)
      .calcular(vehiculo, distanciaKm, pesoCargaKg);
  }

  // Tarifa + recargos informativos (domingo / > 300 km) e importe = tarifa + recargos
  calcularCompleto(
    vehiculo: VehiculoTarifable,
    distanciaKm: number,
    pesoCargaKg: number,
    inicio: Date,
  ): CalculoCompleto {
    const tarifa = this.calcular(vehiculo, distanciaKm, pesoCargaKg);
    const recargo = calcularRecargo(
      tarifa.tarifa,
      distanciaKm,
      inicio,
      this.zona(),
    );
    return {
      tarifa,
      recargo,
      importe: redondear(tarifa.tarifa.plus(recargo.recargo)),
    };
  }

  autonomiaDisponible(vehiculo: VehiculoTarifable) {
    return redondear(autonomiaDisponible(vehiculo));
  }

  zona(): string {
    return this.config.getOrThrow<string>('ZONA_HORARIA');
  }
}

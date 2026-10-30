import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { TipoVehiculo } from '../common/enums';
import { EstrategiaTarifa } from './estrategias/estrategia-tarifa.interface';
import { TarifaCamionStrategy } from './estrategias/tarifa-camion.strategy';
import { TarifaFurgonetaStrategy } from './estrategias/tarifa-furgoneta.strategy';

// Factory: un mapa tipo → estrategia; agregar un tipo no toca el código existente
@Injectable()
export class TarifaFactory {
  private readonly estrategias: ReadonlyMap<TipoVehiculo, EstrategiaTarifa>;

  constructor(
    camion: TarifaCamionStrategy,
    furgoneta: TarifaFurgonetaStrategy,
  ) {
    this.estrategias = new Map<TipoVehiculo, EstrategiaTarifa>(
      [camion, furgoneta].map((e) => [e.tipo, e]),
    );
  }

  obtener(tipo: TipoVehiculo): EstrategiaTarifa {
    const estrategia = this.estrategias.get(tipo);
    if (!estrategia) {
      throw new UnprocessableEntityException(
        `No hay estrategia de tarifa para el tipo ${tipo}`,
      );
    }
    return estrategia;
  }
}

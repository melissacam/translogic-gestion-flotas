import { Module } from '@nestjs/common';
import { TarifaCamionStrategy } from './estrategias/tarifa-camion.strategy';
import { TarifaFurgonetaStrategy } from './estrategias/tarifa-furgoneta.strategy';
import { TarifaFactory } from './tarifa.factory';
import { TarifasService } from './tarifas.service';

@Module({
  providers: [
    TarifaCamionStrategy,
    TarifaFurgonetaStrategy,
    TarifaFactory,
    TarifasService,
  ],
  exports: [TarifasService, TarifaFactory],
})
export class TarifasModule {}

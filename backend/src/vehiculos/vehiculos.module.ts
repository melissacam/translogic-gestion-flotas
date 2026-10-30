import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoVehiculo } from '../common/enums';
import { TarifasModule } from '../tarifas/tarifas.module';
import {
  CamionCarga,
  CamionCargaSchema,
  FurgonetaElectrica,
  FurgonetaElectricaSchema,
  Vehiculo,
  VehiculoSchema,
} from './schemas/vehiculo.schema';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosRepository } from './vehiculos.repository';
import { VehiculosService } from './vehiculos.service';

@Module({
  imports: [
    TarifasModule,
    MongooseModule.forFeature([
      {
        name: Vehiculo.name,
        schema: VehiculoSchema,
        // Herencia sin JOIN: CamionCarga y FurgonetaElectrica comparten la colección
        discriminators: [
          {
            name: CamionCarga.name,
            schema: CamionCargaSchema,
            value: TipoVehiculo.CAMION_CARGA,
          },
          {
            name: FurgonetaElectrica.name,
            schema: FurgonetaElectricaSchema,
            value: TipoVehiculo.FURGONETA_ELECTRICA,
          },
        ],
      },
    ]),
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService, VehiculosRepository],
  exports: [VehiculosRepository, VehiculosService],
})
export class VehiculosModule {}

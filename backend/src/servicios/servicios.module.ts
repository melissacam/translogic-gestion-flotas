import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientesModule } from '../clientes/clientes.module';
import { HistorialModule } from '../historial/historial.module';
import { TarifasModule } from '../tarifas/tarifas.module';
import { VehiculosModule } from '../vehiculos/vehiculos.module';
import { ServicioSchema, ServicioTransporte } from './schemas/servicio.schema';
import { ServiciosController } from './servicios.controller';
import { ServiciosRepository } from './servicios.repository';
import { ServiciosService } from './servicios.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServicioTransporte.name, schema: ServicioSchema },
    ]),
    ClientesModule,
    VehiculosModule,
    TarifasModule,
    HistorialModule,
  ],
  controllers: [ServiciosController],
  providers: [ServiciosService, ServiciosRepository],
  exports: [ServiciosService, ServiciosRepository],
})
export class ServiciosModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HistorialRepository } from './historial.repository';
import { HistorialService } from './historial.service';
import {
  HistorialEstado,
  HistorialEstadoSchema,
} from './schemas/historial-estado.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistorialEstado.name, schema: HistorialEstadoSchema },
    ]),
  ],
  providers: [HistorialService, HistorialRepository],
  exports: [HistorialService, HistorialRepository],
})
export class HistorialModule {}

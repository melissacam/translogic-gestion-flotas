import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientesModule } from '../clientes/clientes.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { FacturasController } from './facturas.controller';
import { FacturasRepository } from './facturas.repository';
import { FacturasService } from './facturas.service';
import { PdfFacturaService } from './pdf-factura.service';
import {
  DetalleFactura,
  DetalleFacturaSchema,
} from './schemas/detalle-factura.schema';
import { Factura, FacturaSchema } from './schemas/factura.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Factura.name, schema: FacturaSchema },
      { name: DetalleFactura.name, schema: DetalleFacturaSchema },
    ]),
    ClientesModule,
    ServiciosModule,
  ],
  controllers: [FacturasController],
  providers: [FacturasService, FacturasRepository, PdfFacturaService],
  exports: [FacturasService],
})
export class FacturasModule {}

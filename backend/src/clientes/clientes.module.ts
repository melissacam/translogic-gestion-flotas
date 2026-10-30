import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientesController } from './clientes.controller';
import { ClientesRepository } from './clientes.repository';
import { ClientesService } from './clientes.service';
import { Cliente, ClienteSchema } from './schemas/cliente.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cliente.name, schema: ClienteSchema }]),
  ],
  controllers: [ClientesController],
  providers: [ClientesService, ClientesRepository],
  exports: [ClientesService, ClientesRepository],
})
export class ClientesModule {}

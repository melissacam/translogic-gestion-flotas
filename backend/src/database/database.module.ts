import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ContadoresRepository } from './contadores.repository';
import { Contador, ContadorSchema } from './schemas/contador.schema';
import { TransaccionService } from './transaccion.service';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        // Índices y colecciones los crean las migraciones (evolución de esquema controlada)
        autoIndex: false,
        autoCreate: false,
      }),
    }),
    MongooseModule.forFeature([
      { name: Contador.name, schema: ContadorSchema },
    ]),
  ],
  providers: [TransaccionService, ContadoresRepository],
  exports: [TransaccionService, ContadoresRepository],
})
export class DatabaseModule {}

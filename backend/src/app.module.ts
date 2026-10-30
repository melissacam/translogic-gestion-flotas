import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { esquemaEntorno } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { FacturasModule } from './facturas/facturas.module';
import { HistorialModule } from './historial/historial.module';
import { ReportesModule } from './reportes/reportes.module';
import { ServiciosModule } from './servicios/servicios.module';
import { TarifasModule } from './tarifas/tarifas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: esquemaEntorno,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    ClientesModule,
    VehiculosModule,
    TarifasModule,
    ServiciosModule,
    HistorialModule,
    FacturasModule,
    ReportesModule,
  ],
  providers: [
    // Orden: primero autenticación (JWT) y luego autorización por rol
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

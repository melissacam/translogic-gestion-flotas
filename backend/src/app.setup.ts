import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SerializacionInterceptor } from './common/interceptors/serializacion.interceptor';

// Configuración compartida por main.ts, las pruebas e2e y la exportación de OpenAPI
export function configurarApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.use(helmet());
  // CORS restringido al origen del frontend
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')
      .map((o) => o.trim()),
    exposedHeaders: ['Content-Disposition'],
  });
  // whitelist + forbidNonWhitelisted: campos no declarados (p. ej. "tarifa") → 400
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new SerializacionInterceptor(),
  );
}

export function crearDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const opciones = new DocumentBuilder()
    .setTitle('TRANSLOGIC S.A. — API de gestión de flotas')
    .setDescription(
      'Flotas, servicios de transporte, tarifas polimórficas, facturación atómica y reportes. ' +
        'Importes como string con 2 decimales.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, opciones);
}

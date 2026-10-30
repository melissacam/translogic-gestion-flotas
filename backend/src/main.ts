import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configurarApp, crearDocumentoOpenApi } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  SwaggerModule.setup('api/docs', app, crearDocumentoOpenApi(app));
  const puerto = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(puerto);
  Logger.log(
    `API en http://localhost:${puerto}/api · Swagger en /api/docs`,
    'Bootstrap',
  );
}

void bootstrap();

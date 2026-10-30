import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';

// Genera docs/openapi.json sin conectarse a la base: preview no instancia proveedores
const VALORES_PREVIEW: Record<string, string> = {
  PORT: '3000',
  MONGODB_URI: 'mongodb://localhost:27017/translogic_db',
  JWT_SECRET: 'solo-para-generar-openapi-1234',
  JWT_EXPIRES_IN: '8h',
  IVA_TASA: '0.15',
  ZONA_HORARIA: 'America/Guayaquil',
  CORS_ORIGIN: 'http://localhost:5173',
};

async function main() {
  for (const [clave, valor] of Object.entries(VALORES_PREVIEW))
    process.env[clave] ??= valor;
  // require diferido: ConfigModule valida el entorno al cargar AppModule
  const { AppModule } =
    require('../src/app.module') as typeof import('../src/app.module');
  const { crearDocumentoOpenApi } =
    require('../src/app.setup') as typeof import('../src/app.setup');
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix('api');
  const documento = crearDocumentoOpenApi(app);
  const destino = join(__dirname, '..', '..', 'docs');
  mkdirSync(destino, { recursive: true });
  writeFileSync(
    join(destino, 'openapi.json'),
    JSON.stringify(documento, null, 2) + '\n',
  );
  console.log(
    `OpenAPI exportado: ${Object.keys(documento.paths).length} rutas → docs/openapi.json`,
  );
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

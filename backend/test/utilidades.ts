import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { Rol } from '../src/common/enums';
import { UsuariosService } from '../src/usuarios/usuarios.service';

const migraciones = [
  '001-crear-colecciones-validadores',
  '002-indices-unicidad',
  '003-contadores',
].map(
  (n) =>
    require(`../migrations/versiones/${n}.js`) as {
      up: (db: unknown) => Promise<void>;
    },
);

export interface Contexto {
  app: INestApplication;
  rs: MongoMemoryReplSet;
  conexion: Connection;
  http: () => ReturnType<typeof request>;
  admin: string;
  operador: string;
}

// Réplica en memoria: las transacciones de MongoDB exigen un replica set
export async function iniciarApp(): Promise<Contexto> {
  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  Object.assign(process.env, {
    PORT: '3999',
    MONGODB_URI: rs.getUri('translogic_test'),
    JWT_SECRET: 'secreto-de-pruebas-e2e-suficientemente-largo',
    JWT_EXPIRES_IN: '1h',
    IVA_TASA: '0.15',
    ZONA_HORARIA: 'America/Guayaquil',
    CORS_ORIGIN: 'http://localhost:5173',
  });

  // ConfigModule valida el entorno al importar AppModule: se carga después de fijar las variables
  const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
  let app: INestApplication;
  try {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication({ logger: ['error'] });
    configurarApp(app);
    await app.init();
  } catch (err) {
    await rs.stop();
    throw err;
  }

  const conexion = app.get<Connection>(getConnectionToken());
  for (const m of migraciones) await m.up(conexion.db);

  const usuarios = app.get(UsuariosService);
  await usuarios.crear(
    'Admin Pruebas',
    'admin@translogic.ec',
    'Admin123*',
    Rol.ADMINISTRADOR,
  );
  await usuarios.crear(
    'Operador Pruebas',
    'operador@translogic.ec',
    'Operador123*',
    Rol.OPERADOR,
  );

  const http = () => request(app.getHttpServer());
  const admin = await login(http, 'admin@translogic.ec', 'Admin123*');
  const operador = await login(http, 'operador@translogic.ec', 'Operador123*');
  return { app, rs, conexion, http, admin, operador };
}

export async function cerrarApp(ctx?: Contexto): Promise<void> {
  await ctx?.app.close();
  await ctx?.rs.stop();
}

async function login(
  http: Contexto['http'],
  email: string,
  password: string,
): Promise<string> {
  const res = await http()
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

let secuencia = 0;
const siguiente = () => String(++secuencia).padStart(4, '0');

export async function crearCliente(
  ctx: Contexto,
  nombre = 'Cliente Prueba',
): Promise<string> {
  const n = siguiente();
  const res = await ctx
    .http()
    .post('/api/clientes')
    .set(bearer(ctx.admin))
    .send({
      identificacion: `099000${n}`,
      nombre,
      correo: `cliente${n}@prueba.ec`,
      telefono: '0991234567',
    })
    .expect(201);
  return res.body.id as string;
}

export async function crearCamion(
  ctx: Contexto,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await ctx
    .http()
    .post('/api/vehiculos')
    .set(bearer(ctx.admin))
    .send({
      tipo: 'CAMION_CARGA',
      placa: `PCA-${siguiente()}`,
      marca: 'Hino',
      modelo: '500',
      anio: 2022,
      capacidadCargaKg: 10000,
      consumoLitros100Km: 30,
      precioLitro: 2.5,
      numeroEjes: 3,
      costoMantenimientoKm: 0.1,
      ...extra,
    })
    .expect(201);
  return res.body.id as string;
}

export async function crearFurgoneta(
  ctx: Contexto,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await ctx
    .http()
    .post('/api/vehiculos')
    .set(bearer(ctx.admin))
    .send({
      tipo: 'FURGONETA_ELECTRICA',
      placa: `PFE-${siguiente()}`,
      marca: 'BYD',
      modelo: 'T3',
      anio: 2024,
      capacidadCargaKg: 1500,
      capacidadBateriaKWh: 60,
      consumoKWh100Km: 20,
      costoKWh: 0.1,
      autonomiaKm: 300,
      porcentajeBateria: 100,
      ...extra,
    })
    .expect(201);
  return res.body.id as string;
}

export interface DatosServicio {
  clienteId: string;
  vehiculoId?: string;
  fecha?: string;
  horaInicio?: string;
  horaFinEstimada?: string;
  distanciaKm?: number;
  pesoCargaKg?: number;
  codigo?: string;
}

export function cuerpoServicio(d: DatosServicio) {
  return {
    codigo: d.codigo ?? `SRV-T${siguiente()}`,
    clienteId: d.clienteId,
    ...(d.vehiculoId ? { vehiculoId: d.vehiculoId } : {}),
    origen: 'Guayaquil',
    destino: 'Quito',
    distanciaKm: d.distanciaKm ?? 200,
    pesoCargaKg: d.pesoCargaKg ?? 5000,
    fecha: d.fecha ?? '2026-11-03',
    horaInicio: d.horaInicio ?? '08:00',
    horaFinEstimada: d.horaFinEstimada ?? '10:00',
  };
}

export async function crearServicio(
  ctx: Contexto,
  d: DatosServicio,
): Promise<string> {
  const res = await ctx
    .http()
    .post('/api/servicios')
    .set(bearer(ctx.operador))
    .send(cuerpoServicio(d));
  if (res.status !== 201)
    throw new Error(`crearServicio ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

export function cambiarEstado(
  ctx: Contexto,
  id: string,
  estado: string,
  extra: Record<string, unknown> = {},
) {
  return ctx
    .http()
    .patch(`/api/servicios/${id}/estado`)
    .set(bearer(ctx.operador))
    .send({ estado, ...extra });
}

export async function crearCompletado(
  ctx: Contexto,
  d: DatosServicio,
): Promise<string> {
  const id = await crearServicio(ctx, d);
  await cambiarEstado(ctx, id, 'EN_EJECUCION').expect(200);
  await cambiarEstado(ctx, id, 'COMPLETADO').expect(200);
  return id;
}

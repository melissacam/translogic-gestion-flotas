import {
  bearer,
  cerrarApp,
  Contexto,
  crearCamion,
  iniciarApp,
} from './utilidades';

describe('Seguridad y roles (Req-09)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await iniciarApp();
  });

  afterAll(() => cerrarApp(ctx));

  it('12a. login correcto devuelve JWT y datos del usuario sin hash', async () => {
    expect(ctx.admin.split('.')).toHaveLength(3);
    const res = await ctx
      .http()
      .get('/api/auth/perfil')
      .set(bearer(ctx.admin))
      .expect(200);
    expect(res.body).toMatchObject({
      email: 'admin@translogic.ec',
      rol: 'ADMINISTRADOR',
    });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('12b. login incorrecto → 401 con mensaje genérico y formato uniforme', async () => {
    const res = await ctx
      .http()
      .post('/api/auth/login')
      .send({ email: 'admin@translogic.ec', password: 'incorrecta' })
      .expect(401);
    expect(res.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Credenciales inválidas',
      path: '/api/auth/login',
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('12c. ruta protegida sin token → 401', async () => {
    await ctx.http().get('/api/vehiculos').expect(401);
    await ctx
      .http()
      .get('/api/vehiculos')
      .set(bearer('token.invalido.x'))
      .expect(401);
  });

  it('13. OPERADOR en POST /facturas → 403', async () => {
    const res = await ctx
      .http()
      .post('/api/facturas')
      .set(bearer(ctx.operador))
      .send({
        clienteId: '665f1c2b9a1e4b3d8c7a1234',
        servicioIds: ['665f1c2b9a1e4b3d8c7a9999'],
      })
      .expect(403);
    expect(res.body.statusCode).toBe(403);
  });

  it('OPERADOR no accede a reportes ni crea vehículos (403)', async () => {
    await ctx
      .http()
      .get('/api/reportes/rentabilidad?anio=2026')
      .set(bearer(ctx.operador))
      .expect(403);
    await ctx
      .http()
      .post('/api/vehiculos')
      .set(bearer(ctx.operador))
      .send({})
      .expect(403);
  });

  it('OPERADOR edita solo kilometraje, batería y estado de un vehículo', async () => {
    const id = await crearCamion(ctx);
    await ctx
      .http()
      .patch(`/api/vehiculos/${id}`)
      .set(bearer(ctx.operador))
      .send({ kilometraje: 1500 })
      .expect(200);
    await ctx
      .http()
      .patch(`/api/vehiculos/${id}`)
      .set(bearer(ctx.operador))
      .send({ precioLitro: 3 })
      .expect(403);
  });

  it('placa duplicada (normalizada) → 409 y borrado lógico a INACTIVO', async () => {
    const id = await crearCamion(ctx, { placa: 'gzz 1234' });
    const dup = await ctx
      .http()
      .post('/api/vehiculos')
      .set(bearer(ctx.admin))
      .send({
        tipo: 'FURGONETA_ELECTRICA',
        placa: 'GZZ1234',
        marca: 'BYD',
        modelo: 'T3',
        anio: 2024,
        capacidadCargaKg: 1500,
        capacidadBateriaKWh: 60,
        consumoKWh100Km: 20,
        costoKWh: 0.1,
        autonomiaKm: 300,
        porcentajeBateria: 90,
      });
    expect(dup.status).toBe(409);
    const res = await ctx
      .http()
      .delete(`/api/vehiculos/${id}`)
      .set(bearer(ctx.admin))
      .expect(200);
    expect(res.body.estado).toBe('INACTIVO');
  });

  it('id con formato inválido → 400', async () => {
    await ctx
      .http()
      .get('/api/vehiculos/no-es-un-id')
      .set(bearer(ctx.admin))
      .expect(400);
  });

  it('límite de intentos de login → 429', async () => {
    const intentos = [];
    for (let i = 0; i < 4; i++) {
      intentos.push(
        await ctx
          .http()
          .post('/api/auth/login')
          .send({ email: 'x@translogic.ec', password: 'nada123' }),
      );
    }
    expect(intentos.map((r) => r.status)).toContain(429);
  });
});

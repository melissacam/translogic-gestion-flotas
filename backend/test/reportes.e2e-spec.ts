import {
  bearer,
  cerrarApp,
  Contexto,
  crearCamion,
  crearCliente,
  crearCompletado,
  crearFurgoneta,
  iniciarApp,
} from './utilidades';

describe('Reportes y consultas avanzadas (Req-07 y Req-08)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await iniciarApp();
  });

  afterAll(() => cerrarApp(ctx));

  it('sin datos: margen 0 y 12 meses vacíos no rompen el dashboard', async () => {
    const res = await ctx
      .http()
      .get('/api/reportes/rentabilidad?anio=2030')
      .set(bearer(ctx.admin))
      .expect(200);
    expect(res.body.kpis).toMatchObject({
      ingresos: '0.00',
      costos: '0.00',
      margen: 0,
    });
  });

  it('rentabilidad con datos: KPIs, 12 meses y tabla por vehículo', async () => {
    const clienteId = await crearCliente(ctx);
    const camion = await crearCamion(ctx);
    const furgoneta = await crearFurgoneta(ctx);
    for (const dia of ['06', '07', '08']) {
      await crearCompletado(ctx, {
        clienteId,
        vehiculoId: camion,
        fecha: `2026-10-${dia}`,
      });
    }
    await crearCompletado(ctx, {
      clienteId,
      vehiculoId: furgoneta,
      fecha: '2026-10-09',
      distanciaKm: 100,
      pesoCargaKg: 500,
    });

    const res = await ctx
      .http()
      .get('/api/reportes/rentabilidad?anio=2026&mes=10')
      .set(bearer(ctx.admin))
      .expect(200);
    // 3 × 229.50 + 26.00 = 714.50 ; costos 3 × 170 + 20 = 530.00
    expect(res.body.kpis).toMatchObject({
      ingresos: '714.50',
      costos: '530.00',
      utilidad: '184.50',
      servicios: 4,
    });
    expect(res.body.comparacionMensual).toHaveLength(12);
    expect(res.body.porVehiculo).toHaveLength(2);
    expect(res.body.distribucionPorTipo).toHaveLength(2);

    const consulta3 = await ctx
      .http()
      .get(
        '/api/reportes/operaciones?consulta=3&desde=2026-10-01&hasta=2026-10-31',
      )
      .set(bearer(ctx.admin))
      .expect(200);
    expect(consulta3.body.resultados[0].completados).toBe(4);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'consulta avanzada %i responde 200',
    async (n) => {
      const res = await ctx
        .http()
        .get(
          `/api/reportes/operaciones?consulta=${n}&desde=2026-10-01&hasta=2026-10-31&mes=2026-10`,
        )
        .set(bearer(ctx.admin))
        .expect(200);
      expect(Array.isArray(res.body.resultados)).toBe(true);
    },
  );

  it('parámetros inválidos → 400', async () => {
    await ctx
      .http()
      .get('/api/reportes/operaciones?consulta=9')
      .set(bearer(ctx.admin))
      .expect(400);
    await ctx
      .http()
      .get('/api/reportes/rentabilidad?anio=2026&mes=13')
      .set(bearer(ctx.admin))
      .expect(400);
  });
});

import { Types } from 'mongoose';
import {
  bearer,
  cambiarEstado,
  cerrarApp,
  Contexto,
  crearCamion,
  crearCliente,
  crearFurgoneta,
  crearServicio,
  cuerpoServicio,
  iniciarApp,
} from './utilidades';

describe('Servicios de transporte (Req-03)', () => {
  let ctx: Contexto;
  let clienteId: string;

  beforeAll(async () => {
    ctx = await iniciarApp();
    clienteId = await crearCliente(ctx);
  });

  afterAll(() => cerrarApp(ctx));

  it('14. concurrencia: dos asignaciones solapadas simultáneas → un 200 y un 409', async () => {
    const vehiculoId = await crearCamion(ctx);
    const a = await crearServicio(ctx, {
      clienteId,
      horaInicio: '08:00',
      horaFinEstimada: '10:00',
    });
    const b = await crearServicio(ctx, {
      clienteId,
      horaInicio: '09:00',
      horaFinEstimada: '11:00',
    });

    const respuestas = await Promise.all(
      [a, b].map((id) =>
        ctx
          .http()
          .patch(`/api/servicios/${id}/asignacion`)
          .set(bearer(ctx.operador))
          .send({ vehiculoId }),
      ),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);

    const asignados = await ctx.conexion
      .collection('servicios')
      .countDocuments({ vehiculoId: new Types.ObjectId(vehiculoId) });
    expect(asignados).toBe(1);
    const ganador = respuestas.find((r) => r.status === 200)!;
    expect(ganador.body.tarifa).toBe('229.50');
    expect(ganador.body.costoOperativo).toBe('170.00');
  });

  it('asignación sin solapamiento en el mismo vehículo sí se permite', async () => {
    const vehiculoId = await crearCamion(ctx);
    await crearServicio(ctx, {
      clienteId,
      vehiculoId,
      horaInicio: '08:00',
      horaFinEstimada: '10:00',
    });
    await crearServicio(ctx, {
      clienteId,
      vehiculoId,
      horaInicio: '10:00',
      horaFinEstimada: '12:00',
    });
  });

  it('15. completar dos veces suma el kilometraje una sola vez', async () => {
    const vehiculoId = await crearCamion(ctx, { kilometraje: 1000 });
    const id = await crearServicio(ctx, {
      clienteId,
      vehiculoId,
      distanciaKm: 250,
      pesoCargaKg: 100,
    });
    await cambiarEstado(ctx, id, 'EN_EJECUCION').expect(200);
    const enServicio = await ctx
      .http()
      .get(`/api/vehiculos/${vehiculoId}`)
      .set(bearer(ctx.admin));
    expect(enServicio.body.estado).toBe('EN_SERVICIO');

    const dobles = await Promise.all([
      cambiarEstado(ctx, id, 'COMPLETADO'),
      cambiarEstado(ctx, id, 'COMPLETADO'),
    ]);
    expect(dobles.map((r) => r.status).sort()).toEqual([200, 409]);
    await cambiarEstado(ctx, id, 'COMPLETADO').expect(409);

    const v = await ctx
      .http()
      .get(`/api/vehiculos/${vehiculoId}`)
      .set(bearer(ctx.admin))
      .expect(200);
    expect(v.body.kilometraje).toBe(1250);
    expect(v.body.estado).toBe('DISPONIBLE');

    const historial = await ctx
      .http()
      .get(`/api/servicios/${id}/historial`)
      .set(bearer(ctx.operador))
      .expect(200);
    expect(
      historial.body.map((h: { estadoNuevo: string }) => h.estadoNuevo),
    ).toEqual(['PROGRAMADO', 'EN_EJECUCION', 'COMPLETADO']);
    expect(historial.body[2].usuarioNombre).toBe('Operador Pruebas');
  });

  it('COMPLETADO → EN_EJECUCION es una transición inválida (409)', async () => {
    const vehiculoId = await crearCamion(ctx);
    const id = await crearServicio(ctx, {
      clienteId,
      vehiculoId,
      pesoCargaKg: 10,
    });
    await cambiarEstado(ctx, id, 'COMPLETADO').expect(409);
    await cambiarEstado(ctx, id, 'EN_EJECUCION').expect(200);
    await cambiarEstado(ctx, id, 'COMPLETADO').expect(200);
    await cambiarEstado(ctx, id, 'EN_EJECUCION').expect(409);
  });

  it('16. furgoneta sin energía suficiente no inicia; con recargaPlanificada sí', async () => {
    // 60 kWh × 20 % / 20 kWh por 100 km = 60 km disponibles para una ruta de 100 km
    const vehiculoId = await crearFurgoneta(ctx, { porcentajeBateria: 20 });
    const id = await crearServicio(ctx, {
      clienteId,
      vehiculoId,
      distanciaKm: 100,
      pesoCargaKg: 300,
    });
    const sinEnergia = await cambiarEstado(ctx, id, 'EN_EJECUCION').expect(422);
    expect(sinEnergia.body.message).toMatch(/Energía insuficiente/);
    const con = await cambiarEstado(ctx, id, 'EN_EJECUCION', {
      recargaPlanificada: true,
    }).expect(200);
    expect(con.body.estado).toBe('EN_EJECUCION');
    expect(con.body.recargaPlanificada).toBe(true);
  });

  it('iniciar sin vehículo asignado → 422', async () => {
    const id = await crearServicio(ctx, { clienteId });
    await cambiarEstado(ctx, id, 'EN_EJECUCION').expect(422);
  });

  it('carga mayor a la capacidad al asignar → 422', async () => {
    const vehiculoId = await crearFurgoneta(ctx);
    const id = await crearServicio(ctx, { clienteId, pesoCargaKg: 5000 });
    await ctx
      .http()
      .patch(`/api/servicios/${id}/asignacion`)
      .set(bearer(ctx.operador))
      .send({ vehiculoId })
      .expect(422);
  });

  it('19. código duplicado → 409; distancia ≤ 0 → 400; tarifa enviada por el cliente → 400', async () => {
    const cuerpo = cuerpoServicio({ clienteId, codigo: 'SRV-DUP-01' });
    await ctx
      .http()
      .post('/api/servicios')
      .set(bearer(ctx.operador))
      .send(cuerpo)
      .expect(201);
    const dup = await ctx
      .http()
      .post('/api/servicios')
      .set(bearer(ctx.operador))
      .send(cuerpo)
      .expect(409);
    expect(dup.body.message).toMatch(/codigo/);

    const cero = cuerpoServicio({ clienteId, distanciaKm: 0 });
    await ctx
      .http()
      .post('/api/servicios')
      .set(bearer(ctx.operador))
      .send(cero)
      .expect(400);

    const manipulada = { ...cuerpoServicio({ clienteId }), tarifa: '1.00' };
    await ctx
      .http()
      .post('/api/servicios')
      .set(bearer(ctx.operador))
      .send(manipulada)
      .expect(400);
  });

  it('simular tarifa no persiste e informa recargos (domingo y > 300 km)', async () => {
    const vehiculoId = await crearCamion(ctx);
    const antes = await ctx.conexion.collection('servicios').countDocuments();
    const res = await ctx
      .http()
      .post('/api/servicios/simular-tarifa')
      .set(bearer(ctx.operador))
      .send({
        vehiculoId,
        distanciaKm: 350,
        pesoCargaKg: 1000,
        fecha: '2026-11-01',
      })
      .expect(200);
    expect(res.body.recargoPorcentaje).toBe(18);
    expect(res.body.motivosRecargo).toHaveLength(2);
    expect(await ctx.conexion.collection('servicios').countDocuments()).toBe(
      antes,
    );
  });

  it('20. paginación y filtros combinados devuelven el total correcto', async () => {
    const otro = await crearCliente(ctx, 'Cliente Paginación');
    const vehiculoId = await crearCamion(ctx);
    for (let i = 0; i < 5; i++) {
      await crearServicio(ctx, { clienteId: otro, fecha: `2026-12-0${i + 1}` });
    }
    await crearServicio(ctx, {
      clienteId: otro,
      vehiculoId,
      fecha: '2026-12-08',
    });

    const res = await ctx
      .http()
      .get(
        `/api/servicios?clienteId=${otro}&estado=PROGRAMADO&desde=2026-12-01&hasta=2026-12-05&limit=2&page=2&sort=fecha:asc`,
      )
      .set(bearer(ctx.operador))
      .expect(200);
    expect(res.body).toMatchObject({
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
    });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].fecha < res.body.data[1].fecha).toBe(true);
    expect(res.body.data[0].cliente.nombre).toBe('Cliente Paginación');

    const porTipo = await ctx
      .http()
      .get(`/api/servicios?clienteId=${otro}&tipoVehiculo=CAMION_CARGA`)
      .set(bearer(ctx.operador))
      .expect(200);
    expect(porTipo.body.total).toBe(1);

    await ctx
      .http()
      .get('/api/servicios?limit=51')
      .set(bearer(ctx.operador))
      .expect(400);
  });
});

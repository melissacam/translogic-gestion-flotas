import { Types } from 'mongoose';
import {
  bearer,
  cerrarApp,
  Contexto,
  crearCamion,
  crearCliente,
  crearCompletado,
  crearServicio,
  iniciarApp,
} from './utilidades';

describe('Facturación atómica (Req-04)', () => {
  let ctx: Contexto;
  let clienteId: string;
  let vehiculoId: string;

  const facturar = (servicioIds: string[], fecha = '2026-11-30') =>
    ctx
      .http()
      .post('/api/facturas')
      .set(bearer(ctx.admin))
      .send({ clienteId, servicioIds, fecha });

  const servicio = (id: string) =>
    ctx.conexion
      .collection('servicios')
      .findOne({ _id: new Types.ObjectId(id) });

  beforeAll(async () => {
    ctx = await iniciarApp();
    clienteId = await crearCliente(ctx);
    vehiculoId = await crearCamion(ctx);
  });

  afterAll(() => cerrarApp(ctx));

  it('17. si un servicio no está completado no se crea factura ni se marca ningún servicio', async () => {
    const completado = await crearCompletado(ctx, {
      clienteId,
      vehiculoId,
      fecha: '2026-11-02',
    });
    const programado = await crearServicio(ctx, {
      clienteId,
      vehiculoId,
      fecha: '2026-11-04',
    });

    const res = await facturar([completado, programado]);
    expect(res.status).toBe(422);
    expect(await ctx.conexion.collection('facturas').countDocuments()).toBe(0);
    expect(
      await ctx.conexion.collection('detalles_factura').countDocuments(),
    ).toBe(0);
    expect((await servicio(completado))!.facturaId).toBeNull();
  });

  it('emite la factura con código correlativo y desglose consistente', async () => {
    const ids = [
      await crearCompletado(ctx, {
        clienteId,
        vehiculoId,
        fecha: '2026-11-01',
        distanciaKm: 350,
        pesoCargaKg: 100,
      }),
      await crearCompletado(ctx, {
        clienteId,
        vehiculoId,
        fecha: '2026-11-05',
      }),
    ];
    const simulada = await ctx
      .http()
      .post('/api/facturas/simular')
      .set(bearer(ctx.admin))
      .send({ clienteId, servicioIds: ids, fecha: '2026-11-30' })
      .expect(200);

    const res = await facturar(ids).expect(201);
    expect(res.body.codigo).toBe('FAC-202611-0001');
    expect(res.body.total).toBe(simulada.body.total);
    expect(res.body.detalles).toHaveLength(2);
    // 3 completados del cliente en noviembre (incluye el del caso anterior) → 5 %
    expect(res.body.porcentajeDescuento).toBe(5);
    // Servicio de 350 km en domingo: recargo 18 % sobre su tarifa
    const largo = res.body.detalles.find(
      (d: { porcentajeRecargo: number }) => d.porcentajeRecargo === 18,
    );
    expect(largo).toBeDefined();
    expect((await servicio(ids[0]))!.facturaId).not.toBeNull();

    const pdf = await ctx
      .http()
      .get(`/api/facturas/${res.body.id}/pdf`)
      .set(bearer(ctx.admin))
      .responseType('blob')
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('18. facturar un servicio ya facturado → 409', async () => {
    const id = await crearCompletado(ctx, {
      clienteId,
      vehiculoId,
      fecha: '2026-11-10',
    });
    await facturar([id]).expect(201);
    const res = await facturar([id]).expect(409);
    expect(res.body.message).toMatch(/ya facturados/);
  });

  it('rollback real: si falla el último paso (índice único) no queda factura parcial', async () => {
    const id = await crearCompletado(ctx, {
      clienteId,
      vehiculoId,
      fecha: '2026-11-12',
    });
    // Detalle huérfano que provoca E11000 en insertMany, después de crear factura y marcar servicio
    await ctx.conexion.collection('detalles_factura').insertOne({
      facturaId: new Types.ObjectId(),
      servicioId: new Types.ObjectId(id),
      tarifa: Types.Decimal128.fromString('1.00'),
      recargos: Types.Decimal128.fromString('0.00'),
      importe: Types.Decimal128.fromString('1.00'),
    });
    const facturasAntes = await ctx.conexion
      .collection('facturas')
      .countDocuments();
    const contadorAntes = await ctx.conexion
      .collection('contadores')
      .findOne({ _id: 'FAC-202611' as never });

    await facturar([id]).expect(409);

    expect(await ctx.conexion.collection('facturas').countDocuments()).toBe(
      facturasAntes,
    );
    expect((await servicio(id))!.facturaId).toBeNull();
    const contadorDespues = await ctx.conexion
      .collection('contadores')
      .findOne({ _id: 'FAC-202611' as never });
    expect(contadorDespues!.secuencia).toBe(contadorAntes!.secuencia);
  });

  it('servicios de otro cliente → 422', async () => {
    const otro = await crearCliente(ctx, 'Otro Cliente');
    const ajeno = await crearCompletado(ctx, {
      clienteId: otro,
      vehiculoId,
      fecha: '2026-11-14',
    });
    await facturar([ajeno]).expect(422);
  });

  it('lista facturas paginadas filtradas por cliente y mes', async () => {
    const res = await ctx
      .http()
      .get(`/api/facturas?clienteId=${clienteId}&mes=2026-11`)
      .set(bearer(ctx.admin))
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0].cliente.nombre).toBe('Cliente Prueba');
  });
});

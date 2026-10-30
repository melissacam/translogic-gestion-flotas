import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Decimal128, Db } from 'mongodb';
import { expresionMargen } from './reportes.repository';

// La expresión $cond del pipeline se evalúa en un MongoDB real ($documents)
describe('11. Margen de rentabilidad', () => {
  let servidor: MongoMemoryServer;
  let cliente: MongoClient;
  let db: Db;

  // En Windows mongod a veces tarda en arrancar: límite explícito y un reintento
  async function iniciarServidor(intentos = 2): Promise<MongoMemoryServer> {
    try {
      return await MongoMemoryServer.create({ instance: { launchTimeout: 30_000 } });
    } catch (err) {
      if (intentos <= 1) throw err;
      return iniciarServidor(intentos - 1);
    }
  }

  beforeAll(async () => {
    servidor = await iniciarServidor();
    cliente = await MongoClient.connect(servidor.getUri());
    db = cliente.db('prueba');
  }, 120_000);

  afterAll(async () => {
    await cliente?.close();
    await servidor?.stop();
  });

  async function margen(ingresos: string, costos: string) {
    const [r] = await db
      .aggregate([
        {
          $documents: [
            {
              ingresos: Decimal128.fromString(ingresos),
              costos: Decimal128.fromString(costos),
            },
          ],
        },
        { $addFields: { utilidad: { $subtract: ['$ingresos', '$costos'] } } },
        { $addFields: { margen: expresionMargen('$ingresos', '$utilidad') } },
      ])
      .toArray();
    return Number(r.margen.toString());
  }

  it('con ingresos = 0 devuelve margen 0 (sin división por cero)', async () => {
    await expect(margen('0', '0')).resolves.toBe(0);
    await expect(margen('0.00', '50.00')).resolves.toBe(0);
  });

  it('calcula utilidad / ingresos × 100', async () => {
    await expect(margen('229.50', '170.00')).resolves.toBeCloseTo(25.9259, 3);
  });
});

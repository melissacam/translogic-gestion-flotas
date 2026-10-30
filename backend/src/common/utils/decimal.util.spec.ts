import { Types } from 'mongoose';
import { serializar } from '../interceptors/serializacion.interceptor';
import { dec, dinero128, formatoDinero, redondear } from './decimal.util';

describe('Aritmética decimal y serialización de importes', () => {
  it('evita el error de punto flotante de number', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(dec(0.1).plus(0.2).toString()).toBe('0.3');
  });

  it('redondea half up a 2 decimales', () => {
    expect(redondear('45.315').toFixed(2)).toBe('45.32');
    expect(redondear('2.345').toFixed(2)).toBe('2.35');
    expect(dinero128('30.602').toString()).toBe('30.60');
  });

  it('serializa Decimal128 como string con 2 decimales y ObjectId como string', () => {
    const id = new Types.ObjectId();
    const r = serializar({
      _id: id,
      tarifa: Types.Decimal128.fromString('229.5'),
      costoKWh: Types.Decimal128.fromString('0.085'),
      passwordHash: 'secreto',
    }) as Record<string, unknown>;
    expect(r).toEqual({
      id: id.toHexString(),
      tarifa: '229.50',
      costoKWh: '0.085',
    });
    expect(formatoDinero('7')).toBe('7.00');
  });
});

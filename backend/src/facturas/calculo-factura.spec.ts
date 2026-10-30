import { dec } from '../common/utils/decimal.util';
import { combinarFechaHora } from '../common/utils/fecha.util';
import { calcularFactura, porcentajeDescuento } from './calculo-factura';

const ZONA = 'America/Guayaquil';

describe('Cálculo de factura (Req-04)', () => {
  it('9. caso de referencia: total 347.42 (domingo + > 300 km, descuento 5 %)', () => {
    const r = calcularFactura(
      [
        {
          servicioId: 'a',
          codigo: 'SRV-A',
          tarifa: dec(100),
          distanciaKm: 350,
          inicio: combinarFechaHora('2026-11-01', '09:00', ZONA), // domingo
        },
        {
          servicioId: 'b',
          codigo: 'SRV-B',
          tarifa: dec(200),
          distanciaKm: 120,
          inicio: combinarFechaHora('2026-11-03', '09:00', ZONA), // martes
        },
      ],
      4,
      '0.15',
      ZONA,
    );
    expect(r.lineas[0].recargo.toFixed(2)).toBe('18.00');
    expect(r.lineas[0].porcentajeRecargo.toNumber()).toBe(18);
    expect(r.lineas[1].recargo.toFixed(2)).toBe('0.00');
    expect(r.subtotal.toFixed(2)).toBe('300.00');
    expect(r.recargos.toFixed(2)).toBe('18.00');
    expect(r.base.toFixed(2)).toBe('318.00');
    expect(r.porcentajeDescuento.toNumber()).toBe(5);
    expect(r.descuento.toFixed(2)).toBe('15.90');
    expect(r.baseImponible.toFixed(2)).toBe('302.10');
    expect(r.impuesto.toFixed(2)).toBe('45.32');
    expect(r.total.toFixed(2)).toBe('347.42');
  });

  it('10. tramos de descuento: 2 → 0 %, 3 y 5 → 5 %, 6 → 10 %', () => {
    expect(porcentajeDescuento(2).toNumber()).toBe(0);
    expect(porcentajeDescuento(3).toNumber()).toBe(5);
    expect(porcentajeDescuento(5).toNumber()).toBe(5);
    expect(porcentajeDescuento(6).toNumber()).toBe(10);
    expect(porcentajeDescuento(15).toNumber()).toBe(10);
  });

  it('el domingo se evalúa en la zona de Guayaquil, no en UTC', () => {
    // Domingo 22:00 en Guayaquil = lunes 03:00 UTC → sí es domingo para el negocio
    const domingoNoche = combinarFechaHora('2026-11-01', '22:00', ZONA);
    expect(domingoNoche.getUTCDay()).toBe(1);
    const r = calcularFactura(
      [
        {
          servicioId: 'x',
          codigo: 'X',
          tarifa: dec(100),
          distanciaKm: 10,
          inicio: domingoNoche,
        },
      ],
      0,
      '0.15',
      ZONA,
    );
    expect(r.recargos.toFixed(2)).toBe('12.00');
  });
});

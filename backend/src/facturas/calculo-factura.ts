import { Dec, dec, redondear } from '../common/utils/decimal.util';
import { calcularRecargo } from '../tarifas/recargos';

export interface LineaEntrada {
  servicioId: string;
  codigo: string;
  tarifa: Dec;
  distanciaKm: number;
  inicio: Date;
}

export interface LineaCalculada extends LineaEntrada {
  porcentajeRecargo: Dec;
  motivosRecargo: string[];
  recargo: Dec;
  importe: Dec;
}

export interface ResultadoFactura {
  lineas: LineaCalculada[];
  subtotal: Dec;
  recargos: Dec;
  base: Dec;
  serviciosCompletadosMes: number;
  porcentajeDescuento: Dec;
  descuento: Dec;
  baseImponible: Dec;
  tasaImpuesto: Dec;
  impuesto: Dec;
  total: Dec;
}

// Un único descuento por factura: 10 % con ≥ 6 completados en el mes, 5 % con 3 a 5
export function porcentajeDescuento(completadosMes: number): Dec {
  if (completadosMes >= 6) return dec(10);
  if (completadosMes >= 3) return dec(5);
  return dec(0);
}

// Fórmula Req-04: redondeo half up a 2 decimales por línea y por total
export function calcularFactura(
  entradas: LineaEntrada[],
  completadosMes: number,
  tasaImpuesto: Dec | number | string,
  zona: string,
): ResultadoFactura {
  const lineas = entradas.map((l) => {
    const r = calcularRecargo(l.tarifa, l.distanciaKm, l.inicio, zona);
    return {
      ...l,
      tarifa: redondear(l.tarifa),
      porcentajeRecargo: r.porcentaje,
      motivosRecargo: r.motivos,
      recargo: r.recargo,
      importe: redondear(l.tarifa.plus(r.recargo)),
    };
  });
  const subtotal = redondear(
    lineas.reduce((acc, l) => acc.plus(l.tarifa), dec(0)),
  );
  const recargos = redondear(
    lineas.reduce((acc, l) => acc.plus(l.recargo), dec(0)),
  );
  const base = subtotal.plus(recargos);
  const pct = porcentajeDescuento(completadosMes);
  const descuento = redondear(base.mul(pct).div(100));
  const baseImponible = base.minus(descuento);
  const tasa = dec(tasaImpuesto);
  const impuesto = redondear(baseImponible.mul(tasa));
  const total = redondear(baseImponible.plus(impuesto));
  return {
    lineas,
    subtotal,
    recargos,
    base: redondear(base),
    serviciosCompletadosMes: completadosMes,
    porcentajeDescuento: pct,
    descuento,
    baseImponible: redondear(baseImponible),
    tasaImpuesto: tasa,
    impuesto,
    total,
  };
}

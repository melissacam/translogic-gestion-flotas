import Decimal from 'decimal.js';
import { Types } from 'mongoose';

// Dinero siempre con decimal.js: 0.1 + 0.2 en number da 0.30000000000000004
export const DecimalDinero = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
export type Dec = Decimal;

// Precios unitarios que pueden tener más de 2 decimales (p. ej. 0.085 USD/kWh)
export const CAMPOS_PRECIO_UNITARIO = new Set([
  'precioLitro',
  'costoKWh',
  'costoMantenimientoKm',
]);

type Numerico = Decimal | number | string | { toString(): string };

export function dec(valor: Numerico | null | undefined): Dec {
  if (valor === null || valor === undefined) return new DecimalDinero(0);
  return new DecimalDinero(valor.toString());
}

// Redondeo half up a 2 decimales: solo en el resultado final de cada importe
export function redondear(valor: Numerico): Dec {
  return dec(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function aDecimal128(valor: Numerico): Types.Decimal128 {
  return Types.Decimal128.fromString(dec(valor).toString());
}

export function dinero128(valor: Numerico): Types.Decimal128 {
  return Types.Decimal128.fromString(redondear(valor).toFixed(2));
}

export function esDecimal128(valor: unknown): valor is Types.Decimal128 {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    (valor as { _bsontype?: string })._bsontype === 'Decimal128'
  );
}

// Formato JSON de importes: string con 2 decimales ("229.50")
export function formatoDinero(valor: Numerico, campo?: string): string {
  const d = dec(valor);
  if (campo && CAMPOS_PRECIO_UNITARIO.has(campo) && d.decimalPlaces() > 2) {
    return d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString();
  }
  return d.toFixed(2, Decimal.ROUND_HALF_UP);
}

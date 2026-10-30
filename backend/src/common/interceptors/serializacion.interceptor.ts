import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { esDecimal128, formatoDinero } from '../utils/decimal.util';

const CAMPOS_OCULTOS = new Set(['passwordHash']);

// Convierte Decimal128 → "229.50" y ObjectId → string en toda respuesta JSON
export function serializar(valor: unknown, campo?: string): unknown {
  if (valor === null || valor === undefined) return valor;
  if (esDecimal128(valor)) return formatoDinero(valor.toString(), campo);
  if (valor instanceof Date || Buffer.isBuffer(valor)) return valor;
  if (Array.isArray(valor)) return valor.map((v) => serializar(v, campo));
  if (typeof valor === 'object') {
    const bson = (valor as { _bsontype?: string })._bsontype;
    if (bson === 'ObjectId' || bson === 'ObjectID') return String(valor);
    const plano =
      typeof (valor as { toObject?: () => unknown }).toObject === 'function'
        ? (valor as { toObject: () => Record<string, unknown> }).toObject()
        : (valor as Record<string, unknown>);
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(plano)) {
      if (CAMPOS_OCULTOS.has(clave)) continue;
      salida[clave === '_id' ? 'id' : clave] = serializar(v, clave);
    }
    return salida;
  }
  return valor;
}

@Injectable()
export class SerializacionInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((datos: unknown) =>
          datos instanceof StreamableFile ? datos : serializar(datos),
        ),
      );
  }
}

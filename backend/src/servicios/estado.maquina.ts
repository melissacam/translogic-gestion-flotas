import { ConflictException } from '@nestjs/common';
import { EstadoServicio } from '../common/enums';

const { PROGRAMADO, EN_EJECUCION, COMPLETADO, CANCELADO } = EstadoServicio;

// Máquina de estados: único lugar donde se definen las transiciones permitidas
export const TRANSICIONES: Readonly<
  Record<EstadoServicio, readonly EstadoServicio[]>
> = {
  [PROGRAMADO]: [EN_EJECUCION, CANCELADO],
  [EN_EJECUCION]: [COMPLETADO, CANCELADO],
  [COMPLETADO]: [],
  [CANCELADO]: [],
};

export function puedeTransicionar(
  desde: EstadoServicio,
  hacia: EstadoServicio,
): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

// Transición no permitida → 409 Conflict
export function validarTransicion(
  desde: EstadoServicio,
  hacia: EstadoServicio,
): void {
  if (!puedeTransicionar(desde, hacia)) {
    throw new ConflictException(`Transición no permitida: ${desde} → ${hacia}`);
  }
}

export function esTerminal(estado: EstadoServicio): boolean {
  return TRANSICIONES[estado].length === 0;
}

import { ConflictException } from '@nestjs/common';
import { EstadoServicio } from '../common/enums';
import {
  esTerminal,
  puedeTransicionar,
  validarTransicion,
} from './estado.maquina';

const { PROGRAMADO, EN_EJECUCION, COMPLETADO, CANCELADO } = EstadoServicio;

describe('8. Máquina de estados del servicio', () => {
  it.each([
    [PROGRAMADO, EN_EJECUCION],
    [PROGRAMADO, CANCELADO],
    [EN_EJECUCION, COMPLETADO],
    [EN_EJECUCION, CANCELADO],
  ])('permite %s → %s', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(true);
    expect(() => validarTransicion(desde, hacia)).not.toThrow();
  });

  it.each([
    [COMPLETADO, EN_EJECUCION],
    [COMPLETADO, CANCELADO],
    [CANCELADO, PROGRAMADO],
    [PROGRAMADO, COMPLETADO],
    [EN_EJECUCION, PROGRAMADO],
    [COMPLETADO, COMPLETADO],
  ])('rechaza %s → %s con 409', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(false);
    expect(() => validarTransicion(desde, hacia)).toThrow(ConflictException);
  });

  it('COMPLETADO y CANCELADO son terminales', () => {
    expect(esTerminal(COMPLETADO)).toBe(true);
    expect(esTerminal(CANCELADO)).toBe(true);
    expect(esTerminal(PROGRAMADO)).toBe(false);
  });
});

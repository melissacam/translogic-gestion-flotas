import { UnprocessableEntityException } from '@nestjs/common';
import { VehiculoTarifable } from './estrategia-tarifa.interface';

// Validaciones comunes de integridad antes de calcular cualquier tarifa (→ 422)
export function validarEntradaTarifa(
  vehiculo: VehiculoTarifable,
  distanciaKm: number,
  pesoCargaKg: number,
): void {
  if (!(distanciaKm > 0)) {
    throw new UnprocessableEntityException(
      'La distancia debe ser mayor a 0 km',
    );
  }
  if (pesoCargaKg < 0) {
    throw new UnprocessableEntityException(
      'El peso de la carga no puede ser negativo',
    );
  }
  if (pesoCargaKg > vehiculo.capacidadCargaKg) {
    throw new UnprocessableEntityException(
      `La carga (${pesoCargaKg} kg) supera la capacidad del vehículo (${vehiculo.capacidadCargaKg} kg)`,
    );
  }
}

export function validarPorcentajeBateria(porcentaje: number | undefined): void {
  if (porcentaje === undefined || porcentaje < 0 || porcentaje > 100) {
    throw new UnprocessableEntityException(
      'El porcentaje de batería debe estar entre 0 y 100',
    );
  }
}

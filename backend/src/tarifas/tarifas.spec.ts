import { UnprocessableEntityException } from '@nestjs/common';
import { TipoVehiculo } from '../common/enums';
import { VehiculoTarifable } from './estrategias/estrategia-tarifa.interface';
import { TarifaCamionStrategy } from './estrategias/tarifa-camion.strategy';
import {
  autonomiaDisponible,
  TarifaFurgonetaStrategy,
} from './estrategias/tarifa-furgoneta.strategy';
import { TarifaFactory } from './tarifa.factory';

const camion: VehiculoTarifable = {
  tipo: TipoVehiculo.CAMION_CARGA,
  capacidadCargaKg: 10000,
  consumoLitros100Km: 30,
  precioLitro: '2.50',
  costoMantenimientoKm: '0.10',
};

const furgoneta: VehiculoTarifable = {
  tipo: TipoVehiculo.FURGONETA_ELECTRICA,
  capacidadCargaKg: 1500,
  capacidadBateriaKWh: 60,
  consumoKWh100Km: 20,
  costoKWh: '0.10',
  autonomiaKm: 200,
  porcentajeBateria: 100,
};

describe('Estrategias de tarifa (Req-02)', () => {
  const estrategiaCamion = new TarifaCamionStrategy();
  const estrategiaFurgoneta = new TarifaFurgonetaStrategy();
  const factory = new TarifaFactory(estrategiaCamion, estrategiaFurgoneta);

  it('1. camión normal: costo operativo 170.00 y tarifa 229.50', () => {
    const r = factory
      .obtener(TipoVehiculo.CAMION_CARGA)
      .calcular(camion, 200, 5000);
    expect(r.costoCombustible!.toFixed(2)).toBe('150.00');
    expect(r.costoMantenimiento.toFixed(2)).toBe('20.00');
    expect(r.costoOperativo.toFixed(2)).toBe('170.00');
    expect(r.tarifa.toFixed(2)).toBe('229.50');
    expect(r.motivoAjuste).toBeNull();
  });

  it('2. camión con carga > 80 % de la capacidad: tarifa 247.86 (+8 %)', () => {
    const r = factory
      .obtener(TipoVehiculo.CAMION_CARGA)
      .calcular(camion, 200, 9000);
    expect(r.tarifaBase.toFixed(2)).toBe('229.50');
    expect(r.ajustePorcentaje.toNumber()).toBe(8);
    expect(r.tarifa.toFixed(2)).toBe('247.86');
  });

  it('carga exactamente en el 80 % no aplica recargo', () => {
    const r = estrategiaCamion.calcular(camion, 200, 8000);
    expect(r.tarifa.toFixed(2)).toBe('229.50');
  });

  it('3. furgoneta normal: tarifa 26.00', () => {
    const r = factory
      .obtener(TipoVehiculo.FURGONETA_ELECTRICA)
      .calcular(furgoneta, 100, 500);
    expect(r.costoEnergetico!.toFixed(2)).toBe('2.00');
    expect(r.costoOperativo.toFixed(2)).toBe('20.00');
    expect(r.tarifa.toFixed(2)).toBe('26.00');
  });

  it('4. furgoneta con distancia > 80 % de autonomía: tarifa 30.60 (+10 %)', () => {
    const r = factory
      .obtener(TipoVehiculo.FURGONETA_ELECTRICA)
      .calcular(furgoneta, 170, 500);
    expect(r.costoEnergetico!.toFixed(2)).toBe('3.40');
    expect(r.ajustePorcentaje.toNumber()).toBe(10);
    expect(r.tarifa.toFixed(2)).toBe('30.60');
  });

  it('5. autonomía disponible: 60 kWh al 50 % con 20 kWh/100 km = 150 km', () => {
    const v = { ...furgoneta, porcentajeBateria: 50 };
    expect(autonomiaDisponible(v).toNumber()).toBe(150);
    expect(
      estrategiaFurgoneta.calcular(v, 50, 0).autonomiaDisponibleKm!.toFixed(2),
    ).toBe('150.00');
  });

  it('6. rechaza una carga mayor a la capacidad del vehículo (422)', () => {
    expect(() => estrategiaCamion.calcular(camion, 200, 10001)).toThrow(
      UnprocessableEntityException,
    );
    expect(() => estrategiaFurgoneta.calcular(furgoneta, 50, 1501)).toThrow(
      /supera la capacidad/,
    );
  });

  it('7b. rechaza porcentaje de batería fuera de 0–100 en el servicio (422)', () => {
    expect(() =>
      estrategiaFurgoneta.calcular(
        { ...furgoneta, porcentajeBateria: 140 },
        50,
        0,
      ),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      estrategiaFurgoneta.calcular(
        { ...furgoneta, porcentajeBateria: -1 },
        50,
        0,
      ),
    ).toThrow(/entre 0 y 100/);
  });

  it('rechaza distancia ≤ 0 y peso negativo (422)', () => {
    expect(() => estrategiaCamion.calcular(camion, 0, 100)).toThrow(
      /mayor a 0/,
    );
    expect(() => estrategiaCamion.calcular(camion, 10, -1)).toThrow(/negativo/);
  });
});

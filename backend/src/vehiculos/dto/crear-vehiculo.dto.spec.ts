import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TipoVehiculo } from '../../common/enums';
import { ActualizarVehiculoDto } from './actualizar-vehiculo.dto';
import { CrearVehiculoDto } from './crear-vehiculo.dto';

const furgoneta = {
  tipo: TipoVehiculo.FURGONETA_ELECTRICA,
  placa: 'gbc 4321',
  marca: 'BYD',
  modelo: 'T3',
  anio: 2024,
  capacidadCargaKg: 1500,
  capacidadBateriaKWh: 60,
  consumoKWh100Km: 20,
  costoKWh: 0.1,
  autonomiaKm: 300,
  porcentajeBateria: 80,
};

async function errores(cls: new () => object, datos: object) {
  const r = await validate(plainToInstance(cls, datos));
  return r.map((e) => e.property);
}

describe('Validación de DTO de vehículos', () => {
  it('acepta una furgoneta válida y normaliza la placa', async () => {
    const dto = plainToInstance(CrearVehiculoDto, furgoneta);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.placa).toBe('GBC4321');
  });

  it('7a. rechaza porcentaje de batería fuera de 0–100 (DTO)', async () => {
    expect(
      await errores(CrearVehiculoDto, { ...furgoneta, porcentajeBateria: 140 }),
    ).toContain('porcentajeBateria');
    expect(
      await errores(CrearVehiculoDto, { ...furgoneta, porcentajeBateria: -5 }),
    ).toContain('porcentajeBateria');
    expect(
      await errores(ActualizarVehiculoDto, { porcentajeBateria: 101 }),
    ).toContain('porcentajeBateria');
  });

  it('exige los campos propios del camión (validación condicional por tipo)', async () => {
    const camion = { ...furgoneta, tipo: TipoVehiculo.CAMION_CARGA };
    const props = await errores(CrearVehiculoDto, camion);
    expect(props).toEqual(
      expect.arrayContaining([
        'consumoLitros100Km',
        'precioLitro',
        'numeroEjes',
      ]),
    );
  });

  it('rechaza año anterior a 1990 y posterior al próximo año', async () => {
    expect(
      await errores(CrearVehiculoDto, { ...furgoneta, anio: 1989 }),
    ).toContain('anio');
    const futuro = new Date().getFullYear() + 2;
    expect(
      await errores(CrearVehiculoDto, { ...furgoneta, anio: futuro }),
    ).toContain('anio');
  });
});

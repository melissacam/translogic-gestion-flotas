import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginado } from '../common/dto/paginacion.dto';
import { ClientesRepository } from './clientes.repository';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { FiltroClientesDto } from './dto/filtro-clientes.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly repo: ClientesRepository) {}

  async listar(filtro: FiltroClientesDto) {
    const { data, total } = await this.repo.listar(
      filtro.q,
      filtro.page,
      filtro.limit,
    );
    return paginado(data, total, filtro.page, filtro.limit);
  }

  async obtener(id: string) {
    const cliente = await this.repo.buscarPorId(id);
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async crear(dto: CrearClienteDto) {
    // Unicidad de identificación: la garantiza el índice único (E11000 → 409)
    const creado = await this.repo.crear(dto);
    return this.obtener(creado._id.toString());
  }

  async actualizar(id: string, dto: ActualizarClienteDto) {
    const actualizado = await this.repo.actualizar(id, dto);
    if (!actualizado) throw new NotFoundException('Cliente no encontrado');
    return actualizado;
  }

  async eliminar(id: string) {
    await this.obtener(id);
    // Integridad referencial: no se borra un cliente que ya tiene servicios
    if (await this.repo.tieneServicios(id)) {
      throw new ConflictException(
        'El cliente tiene servicios registrados y no puede eliminarse',
      );
    }
    await this.repo.eliminar(id);
    return { eliminado: true };
  }
}

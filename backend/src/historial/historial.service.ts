import { Injectable } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import { EstadoServicio } from '../common/enums';
import { HistorialRepository } from './historial.repository';

@Injectable()
export class HistorialService {
  constructor(private readonly repo: HistorialRepository) {}

  // Se llama dentro de la misma transacción que cambia el estado del servicio
  registrar(
    servicioId: Types.ObjectId,
    estadoAnterior: EstadoServicio | null,
    estadoNuevo: EstadoServicio,
    usuarioId: string,
    session: ClientSession,
    observacion?: string,
  ) {
    return this.repo.registrar(
      {
        servicioId,
        estadoAnterior,
        estadoNuevo,
        fecha: new Date(),
        usuarioId: new Types.ObjectId(usuarioId),
        observacion,
      },
      session,
    );
  }

  listarPorServicio(servicioId: string) {
    return this.repo.listarPorServicio(servicioId);
  }
}

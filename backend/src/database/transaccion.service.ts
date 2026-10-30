import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

// Unidad de trabajo: todo lo que corre en fn se confirma o se revierte junto
@Injectable()
export class TransaccionService {
  constructor(@InjectConnection() private readonly conexion: Connection) {}

  async ejecutar<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.conexion.startSession();
    try {
      let resultado: T | undefined;
      // withTransaction reintenta la función si hay WriteConflict (TransientTransactionError)
      await session.withTransaction(
        async () => {
          resultado = await fn(session);
        },
        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
      );
      return resultado as T;
    } finally {
      await session.endSession();
    }
  }
}

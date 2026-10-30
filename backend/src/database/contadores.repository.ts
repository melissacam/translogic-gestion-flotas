import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Contador } from './schemas/contador.schema';

@Injectable()
export class ContadoresRepository {
  constructor(
    @InjectModel(Contador.name) private readonly modelo: Model<Contador>,
  ) {}

  // $inc atómico con upsert: dos facturas nunca reciben el mismo número
  async siguiente(clave: string, session?: ClientSession): Promise<number> {
    const doc = await this.modelo
      .findOneAndUpdate(
        { _id: clave },
        { $inc: { secuencia: 1 } },
        { upsert: true, returnDocument: 'after', session },
      )
      .lean();
    return doc!.secuencia;
  }
}

import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesRepository } from './reportes.repository';
import { ReportesService } from './reportes.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, ReportesRepository],
})
export class ReportesModule {}

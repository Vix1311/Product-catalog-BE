import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExcelImportService } from './excel-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService, ExcelImportService],
  exports: [ProductsService, ExcelImportService],
})
export class ProductsModule {}

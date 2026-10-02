import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BrandsModule } from './brands/brands.module';
import { ProductsModule } from './products/products.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';

@Module({
  imports: [BrandsModule, ProductsModule, ProductVariantsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

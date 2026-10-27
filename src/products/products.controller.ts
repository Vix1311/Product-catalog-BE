import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from '../common/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/roles.guard';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { ExcelImportService } from './excel-import.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service'; // 1. Import CloudinaryService

@Controller('api/products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly excelImportService: ExcelImportService,
    private readonly cloudinaryService: CloudinaryService, // 2. Inject vào constructor
  ) {}

  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.excelImportService.importExcelProductData(file.buffer);
  }

  @Post()
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(@Query() query: GetProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  // 3. Cập nhật lại route upload ảnh bằng Cloudinary
  @Patch(':id/image')
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async patchUploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // 1. Kiểm tra sản phẩm tồn tại
    await this.productsService.findOne(id);

    // 2. Upload ảnh mới lên Cloudinary
    const result = await this.cloudinaryService.uploadFile(file);

    // 3. Gọi service cập nhật DB (hàm service sẽ tự lo việc xóa ảnh cũ dựa vào public_id cũ)
    return this.productsService.updateImageUrl(
      id,
      result.secure_url,
      result.public_id, // Truyền thêm public_id lên đây
    );
  }
}

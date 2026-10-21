import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto'; // Thêm dòng này

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  // 1. TẠO HÃNG MỚI
  async create(createBrandDto: CreateBrandDto) {
    const existingBrand = await this.prisma.brand.findUnique({
      where: { name: createBrandDto.name },
    });

    if (existingBrand) {
      throw new ConflictException('Thương hiệu này đã tồn tại trong hệ thống!');
    }

    return this.prisma.brand.create({
      data: createBrandDto,
    });
  }

  // 2. LẤY DANH SÁCH TẤT CẢ CÁC HÃNG
  async findAll() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // 3. LẤY THÔNG TIN CHI TIẾT 1 HÃNG
  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) throw new NotFoundException('Không tìm thấy thương hiệu này!');
    return brand;
  }

  // 4. CẬP NHẬT THÔNG TIN HÃNG
  async update(id: string, updateBrandDto: UpdateBrandDto) {
    // Kế thừa hàm findOne để kiểm tra xem ID có tồn tại không
    await this.findOne(id);

    // Nếu người dùng muốn đổi tên hãng, phải đảm bảo tên mới không trùng với hãng khác
    if (updateBrandDto.name) {
      const existingBrand = await this.prisma.brand.findUnique({
        where: { name: updateBrandDto.name },
      });
      if (existingBrand && existingBrand.id !== id) {
        throw new ConflictException('Tên thương hiệu này đã được sử dụng!');
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: updateBrandDto,
    });
  }

  // 5. XÓA HÃNG
  async remove(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Không tìm thấy thương hiệu này!');

    return this.prisma.brand.delete({
      where: { id },
    });
  }
}

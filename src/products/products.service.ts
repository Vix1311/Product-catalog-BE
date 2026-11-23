import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductDto,
    });
  }

  // Trong file products.service.ts của NestJS
  async findAll(query: {
    category?: string;
    subCategory?: string;
    search?: string;
  }) {
    const where: any = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.subCategory && query.subCategory !== 'ALL') {
      where.subCategory = {
        contains: query.subCategory,
        mode: 'insensitive',
      };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { englishName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: {
        variants: {
          include: {
            brand: true,
          },
        },
      },
    });
  }

  private buildWhereClause(query: {
    category?: string;
    subCategory?: string;
    search?: string;
  }) {
    const where: any = {};

    if (query.category && query.category !== 'ALL') {
      where.category = query.category;
    }

    if (query.subCategory && query.subCategory !== 'ALL') {
      where.subCategory = {
        contains: query.subCategory,
        mode: 'insensitive',
      };
    }

    if (query.search?.trim()) {
      const keyword = query.search.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { englishName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async findCatalogCards(query: GetProductsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          englishName: true,
          category: true,
          subCategory: true,
          imageUrl: true,
          productSpec: true,
          marketPopularity: true,
          suitableChannels: true,
          // Chỉ lấy tối thiểu thông tin biến thể/thương hiệu để hiển thị badge trên card
          variants: {
            select: {
              id: true,
              unit: true,
              packaging: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  origin: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            brand: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }

  // Thêm cloudinaryService vào constructor của ProductsService

  // Cập nhật lại hàm updateImageUrl
  async updateImageUrl(id: string, imageUrl: string, imagePublicId: string) {
    const product = await this.findOne(id);

    // Nếu sản phẩm đã có ảnh cũ trên Cloudinary, tiến hành xóa nó đi
    if (product.imagePublicId) {
      await this.cloudinaryService.deleteFile(product.imagePublicId);
    }

    // Cập nhật link mới và public_id mới vào database
    return this.prisma.product.update({
      where: { id },
      data: {
        imageUrl,
        imagePublicId,
      },
    });
  }
}

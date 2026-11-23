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

  private readonly defaultOrderBy = [
    { category: 'asc' as const },
    { subCategory: 'asc' as const },
    { name: 'asc' as const },
  ];
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
      orderBy: this.defaultOrderBy,
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

  private truncateText(text: string | null, maxLength = 160): string | null {
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  async findCatalogCards(query: GetProductsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 12;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.defaultOrderBy,
        select: {
          id: true,
          name: true,
          englishName: true,
          category: true,
          subCategory: true,
          imageUrl: true,
          suitableDishes: true,
          characteristics: true,
          description: true,
          variants: {
            select: {
              brand: {
                select: {
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

    const lightItems = items.map((item) => ({
      ...item,
      suitableDishes: this.truncateText(item.suitableDishes),
      characteristics: this.truncateText(item.characteristics),
      description: this.truncateText(item.description),
    }));

    return {
      data: lightItems,
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

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductVariantsService {
  constructor(private prisma: PrismaService) {}

  async create(createVariantDto: CreateProductVariantDto) {
    return this.prisma.productVariant.create({
      data: createVariantDto,
      include: {
        brand: true,
      },
    });
  }

  async updateVariant(id: string, updateVariantDto: UpdateProductVariantDto) {
    return this.prisma.productVariant.update({
      where: { id },
      data: updateVariantDto,
      include: {
        brand: true,
      },
    });
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: {
        variants: {
          include: {
            brand: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        brand: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`ProductVariant with ID ${id} not found`);
    }

    return variant;
  }

  async update(id: string, updateProductVariantDto: UpdateProductVariantDto) {
    await this.findOne(id); // Check existence

    try {
      return await this.prisma.productVariant.update({
        where: { id },
        data: updateProductVariantDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'A product variant with this product and brand combination already exists.',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence

    return this.prisma.productVariant.delete({
      where: { id },
    });
  }
}

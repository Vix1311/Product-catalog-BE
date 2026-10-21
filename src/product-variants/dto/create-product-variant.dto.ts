import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProductVariantDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsNotEmpty()
  brandId!: string;

  @IsString()
  @IsOptional()
  sku?: string; 

  @IsString()
  @IsOptional()
  unit?: string; 

  @IsString()
  @IsOptional()
  packaging?: string; 

  @IsString()
  @IsOptional()
  brandNote?: string;

}
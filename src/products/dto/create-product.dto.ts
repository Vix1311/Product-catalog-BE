import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  englishName?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;
  
  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsString()
  @IsOptional()
  suitableDishes?: string;

  @IsString()
  @IsOptional()
  characteristics?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  productSpec?: string; 

  @IsString()
  @IsOptional()
  marketPopularity?: string;

  @IsString()
  @IsOptional()
  suitableChannels?: string;
}

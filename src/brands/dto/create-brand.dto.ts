import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên thương hiệu không được để trống' })
  name!: string;

  @IsString()
  @IsOptional() // Có thể điền hoặc không
  origin?: string;
}

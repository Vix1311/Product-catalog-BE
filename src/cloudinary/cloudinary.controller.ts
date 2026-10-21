import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';

@Controller('api/test-upload')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    // Gọi hàm upload từ service
    const result = await this.cloudinaryService.uploadFile(file);

    // Trả về kết quả cho client
    return {
      message: 'Upload thành công!',
      url: result.secure_url, // Link ảnh HTTPS
      public_id: result.public_id, // ID của ảnh trên Cloudinary
      size: result.bytes, // Dung lượng ảnh
    };
  }
}

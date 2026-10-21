import { Injectable, BadRequestException } from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  // Trả về đúng kiểu dữ liệu UploadApiResponse
  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    // Validate cơ bản nếu frontend không gửi file
    if (!file) {
      throw new BadRequestException('Không tìm thấy file đính kèm!');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'product_catalog', // Đặt tên thư mục của dự án
          resource_type: 'image', // Chỉ chấp nhận ảnh
        },
        (error, result) => {
          if (error) {
            return reject(
              new BadRequestException(`Lỗi Cloudinary: ${error.message}`),
            );
          }
          resolve(result!);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}

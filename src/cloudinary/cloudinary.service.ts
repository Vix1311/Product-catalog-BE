import { Injectable, BadRequestException } from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file đính kèm!');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'product_catalog',
          resource_type: 'image',
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

  // THÊM HÀM NÀY ĐỂ XÓA ẢNH CŨ
  async deleteFile(publicId: string): Promise<any> {
    if (!publicId) return;
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          return reject(
            new BadRequestException(`Lỗi khi xóa ảnh cũ: ${error.message}`),
          );
        }
        resolve(result);
      });
    });
  }
}

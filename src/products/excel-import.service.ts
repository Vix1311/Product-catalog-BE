import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

// Helper tách văn bản nhiều dòng
function splitLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Map chuyển đổi từ Cột 'Nhóm' trong Excel sang { category, subCategory }
function mapCategoryAndSubCategory(rawNhom: string | undefined | null): {
  category: string;
  subCategory: string;
} {
  if (!rawNhom) {
    return { category: 'thit-nhap-khau', subCategory: 'KHÁC' };
  }

  const nhomNormalized = rawNhom.toString().trim().toUpperCase();

  // 1. Nhóm Thịt Nhập Khẩu
  const proteinGroups = ['HEO', 'BÒ', 'GÀ', 'TRÂU', 'CỪU', 'DÊ', 'HẢI SẢN'];
  if (proteinGroups.includes(nhomNormalized)) {
    return {
      category: 'thit-nhap-khau',
      subCategory: nhomNormalized,
    };
  }

  // 2. Nhóm Surimi & Chả cá (Thanh cua, Topping viên surimi)
  if (['THANH CUA', 'TOPPING', 'SURIMI', 'CHẢ CÁ'].includes(nhomNormalized)) {
    return {
      category: 'surimi',
      subCategory: nhomNormalized, // "THANH CUA" hoặc "TOPPING"
    };
  }

  // 3. Nhóm Sauce / Nước sốt & Đồ ăn kèm (Kim chi, Dưa cải)
  if (['ĂN KÈM', 'SAUCE', 'NƯỚC SỐT', 'MAYONNAISE'].includes(nhomNormalized)) {
    return {
      category: 'sauce',
      subCategory: nhomNormalized, // "ĂN KÈM"
    };
  }

  // 4. Các danh mục mở rộng khác (nếu có sau này)
  switch (nhomNormalized) {
    case 'BIA':
    case 'ĐỒ UỐNG':
      return { category: 'bia', subCategory: nhomNormalized };
    case 'CHÀ BÔNG':
      return { category: 'cha-bong', subCategory: nhomNormalized };
    case 'RTE':
      return { category: 'rte', subCategory: nhomNormalized };
    case 'RTC':
      return { category: 'rtc', subCategory: nhomNormalized };
    case 'OEM':
    case 'ODM':
      return { category: 'oem-odm', subCategory: nhomNormalized };
    default:
      return { category: 'thit-nhap-khau', subCategory: nhomNormalized };
  }
}
@Injectable()
export class ExcelImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importExcelProductData(fileBuffer: Buffer) {
    // 1. Đọc file Excel từ Buffer
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    const errors: { row: number; error: string }[] = [];

    // 2. Duyệt qua từng dòng dữ liệu
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 2; // Dòng 1 là Header trong Excel

      const productName = row['Tên sản phẩm báo giá']?.toString().trim();
      if (!productName) {
        errors.push({ row: rowNum, error: 'Thiếu tên sản phẩm' });
        continue;
      }

      // 🎯 BƯỚC XỬ LÝ CHUẨN HÓA CATEGORY VÀ SUBCATEGORY
      const { category, subCategory } = mapCategoryAndSubCategory(row['Nhóm']);

      try {
        await this.prisma.$transaction(async (tx) => {
          // A. Tìm hoặc tạo Product
          let product = await tx.product.findFirst({
            where: { name: productName },
          });

          const productData = {
            category: category, // ⭕ VD: "thit-nhap-khau"
            subCategory: subCategory, // ⭕ VD: "HEO", "BÒ", "GÀ", "TRÂU"
            englishName: row['Tên tiếng Anh'] || null,
            suitableDishes: row['Phù hợp món'] || null,
            characteristics: row['Đặc điểm sản phẩm'] || null,
            productSpec: row['Quy cách sản phẩm & cắt hàng'] || null,
            marketPopularity: row['Mức độ phổ biến trên thị trường'] || null,
            suitableChannels: row['Phù hợp với kênh quán'] || null,
            imageUrl:
              row['Ảnh hiển thị'] ||
              row['Ảnh catalogue — đường dẫn tư liệu'] ||
              null,
          };

          if (!product) {
            product = await tx.product.create({
              data: {
                name: productName,
                ...productData,
              },
            });
          } else {
            product = await tx.product.update({
              where: { id: product.id },
              data: productData,
            });
          }

          // B. Tách dữ liệu đa dòng Thương hiệu & Quy cách
          const brandLines = splitLines(row['Thương hiệu & Xuất xứ tham khảo']);
          const specLines = splitLines(row['Quy cách thùng/ theo nguồn']);
          const noteLines = splitLines(
            row['Phân tích đặc điểm từng thương hiệu'],
          );

          for (let i = 0; i < brandLines.length; i++) {
            const rawBrand = brandLines[i];
            if (!rawBrand.includes(':')) continue;

            const [brandName, origin] = rawBrand
              .split(':')
              .map((s) => s.trim());
            if (!brandName) continue;

            // B1. Upsert Brand
            const brand = await tx.brand.upsert({
              where: { name: brandName },
              update: { origin: origin || undefined },
              create: { name: brandName, origin: origin || null },
            });

            const packagingInfo = specLines[i]
              ? specLines[i].replace(`${brandName}:`, '').trim()
              : null;
            const brandNoteInfo = noteLines[i] ? noteLines[i].trim() : null;

            // B2. Liên kết Khóa phụ vào ProductVariant
            await tx.productVariant.upsert({
              where: {
                productId_brandId: {
                  productId: product.id,
                  brandId: brand.id,
                },
              },
              update: {
                packaging: packagingInfo,
                brandNote: brandNoteInfo,
              },
              create: {
                productId: product.id,
                brandId: brand.id,
                packaging: packagingInfo,
                brandNote: brandNoteInfo,
              },
            });
          }
        });

        successCount++;
      } catch (err: any) {
        errors.push({
          row: rowNum,
          error: err.message || 'Lỗi không xác định',
        });
      }
    }

    return { total: rows.length, successCount, errors };
  }
}

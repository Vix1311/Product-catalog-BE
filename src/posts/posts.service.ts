import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as mammoth from 'mammoth';
import * as TurndownService from 'turndown';
const { gfm } = require('turndown-plugin-gfm');

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  // Helper tạo slug tiếng Việt không dấu
  private generateSlug(text: string): string {
    return (
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Date.now().toString().slice(-4)
    );
  }

  // 1. IMPORT FILE WORD (.DOCX) THÀNH BÀI VIẾT BLOG
  async createFromWord(
    wordFile: Express.Multer.File,
    coverImage?: Express.Multer.File,
    bodyData?: {
      title?: string;
      category?: string;
      tags?: string;
      featured?: string;
    },
  ) {
    if (!wordFile) {
      throw new BadRequestException('Vui lòng đính kèm file Word (.docx)');
    }

    // A. Chuyển Word sang HTML và tự động đẩy các ảnh nhúng trong Word lên Cloudinary
    const htmlResult = await mammoth.convertToHtml(
      { buffer: wordFile.buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.read();
          const fakeMulterFile: any = {
            buffer: imageBuffer,
            mimetype: image.contentType,
          };
          const uploaded = await this.cloudinaryService.uploadFile(fakeMulterFile);
          return { src: uploaded.secure_url };
        }),
      },
    );

    // B. Chuyển HTML (có cả Table) sang Markdown chuẩn GFM
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
    });
    turndownService.use(gfm); // Bật plugin giữ nguyên cấu trúc Bảng (Table)
    const markdownContent = turndownService.turndown(htmlResult.value);

    // C. Upload ảnh bìa (nếu có gửi kèm), nếu không lấy ảnh mặc định
    let imageUrl =
      'https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=1000&auto=format&fit=crop';
    let imagePublicId: string | null = null;

    if (coverImage) {
      const uploadedCover = await this.cloudinaryService.uploadFile(coverImage);
      imageUrl = uploadedCover.secure_url;
      imagePublicId = uploadedCover.public_id;
    }

    // D. Tự động lấy tiêu đề và tóm tắt
    const defaultTitle = wordFile.originalname.replace(/\.[^/.]+$/, '');
    const finalTitle = bodyData?.title?.trim() || defaultTitle;
    const slug = this.generateSlug(finalTitle);

    const plainText = (await mammoth.extractRawText({ buffer: wordFile.buffer })).value;
    const excerpt =
      plainText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 40)[0]
        ?.slice(0, 180) + '...' || 'Cẩm nang kiến thức thực phẩm nhập khẩu B2B từ Khánh An Foods.';

    // Ước tính thời gian đọc
    const wordCount = plainText.split(/\s+/).length;
    const readMinutes = Math.max(2, Math.ceil(wordCount / 220));

    const parsedTags = bodyData?.tags
      ? bodyData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : ['Thịt nhập khẩu', 'Cẩm nang B2B', 'Khánh An Foods'];

    return this.prisma.post.create({
      data: {
        title: finalTitle,
        slug,
        excerpt,
        category: bodyData?.category || 'Kiến Thức Nguyên Liệu',
        imageUrl,
        imagePublicId,
        readTime: `${readMinutes} phút đọc`,
        featured: bodyData?.featured === 'true',
        tags: parsedTags,
        content: markdownContent,
      },
    });
  }

  // 2. LẤY DANH SÁCH BÀI VIẾT
  async findAll(query: { category?: string; search?: string }) {
    const where: any = { published: true };

    if (query.category && query.category !== 'Tất cả') {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    return posts.map((p) => ({
      ...p,
      date: new Date(p.createdAt).toLocaleDateString('vi-VN'),
    }));
  }

  // 3. LẤY CHI TIẾT BÀI VIẾT (Hỗ trợ tìm bằng cả Slug hoặc ID)
  async findOne(slugOrId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
    });

    if (!post) {
      throw new NotFoundException(`Không tìm thấy bài viết "${slugOrId}"`);
    }

    const relatedPosts = await this.prisma.post.findMany({
      where: {
        category: post.category,
        id: { not: post.id },
        published: true,
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    return {
      post: {
        ...post,
        date: new Date(post.createdAt).toLocaleDateString('vi-VN'),
      },
      relatedPosts: relatedPosts.map((r) => ({
        ...r,
        date: new Date(r.createdAt).toLocaleDateString('vi-VN'),
      })),
    };
  }

  // 4. XÓA BÀI VIẾT & XÓA ẢNH TRÊN CLOUDINARY
  async remove(id: string) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (existing.imagePublicId) {
      await this.cloudinaryService.deleteFile(existing.imagePublicId);
    }

    return this.prisma.post.delete({ where: { id } });
  }
}
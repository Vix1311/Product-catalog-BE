import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as mammoth from 'mammoth';
import TurndownService from 'turndown';
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

  // Helper: Tự động chuyển đổi các dòng chứa link Video trong Markdown thành thẻ <video> hoặc <iframe>
  private parseVideoLinksInMarkdown(markdown: string): string {
    return markdown
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();

        // 1. Nhận diện cú pháp "Video: https://..." hoặc đường link file video trực tiếp (.mp4, .webm, .mov)
        const videoMatch =
          trimmed.match(
            /^(?:Video:\s*)?(https?:\/\/[^\s]+\.(?:mp4|webm|ogg|mov)(?:\?[^\s]*)?)$/i,
          ) || trimmed.match(/^Video:\s*(https?:\/\/[^\s]+)$/i);

        if (videoMatch) {
          const url = videoMatch[1];
          // Kiểm tra nếu là link YouTube trong cú pháp "Video: ..."
          const ytMatch = url.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          );
          if (ytMatch) {
            return `\n<iframe width="100%" height="420" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>\n`;
          }
          return `\n<video controls width="100%" src="${url}"></video>\n`;
        }

        // 2. Nhận diện dòng chỉ chứa độc lập 1 link YouTube
        const standaloneYt = trimmed.match(
          /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)$/i,
        );
        if (standaloneYt) {
          return `\n<iframe width="100%" height="420" src="https://www.youtube.com/embed/${standaloneYt[1]}" frameborder="0" allowfullscreen></iframe>\n`;
        }

        return line;
      })
      .join('\n');
  }

  // MỚI: Upload ảnh hoặc video lẻ để chèn vào giữa bài viết
  async uploadInlineMedia(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng chọn file ảnh hoặc video để tải lên',
      );
    }
    const uploaded = await this.cloudinaryService.uploadFile(file);
    const isVideo =
      file.mimetype.startsWith('video/') ||
      /\.(mp4|webm|ogg|mov)$/i.test(file.originalname);

    const url = uploaded.secure_url;
    const markdown = isVideo
      ? `\n<video controls width="100%" src="${url}"></video>\n`
      : `\n![${file.originalname.replace(/\.[^/.]+$/, '')}](${url})\n`;

    return {
      url,
      publicId: uploaded.public_id,
      type: isVideo ? 'video' : 'image',
      markdown,
    };
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
          const uploaded =
            await this.cloudinaryService.uploadFile(fakeMulterFile);
          return { src: uploaded.secure_url };
        }),
      },
    );

    // B. Chuyển HTML (có cả Table) sang Markdown chuẩn GFM
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
    });
    turndownService.use(gfm);
    const rawMarkdown = turndownService.turndown(htmlResult.value);

    // Xử lý tự động các link Video trong bài Word
    const markdownContent = this.parseVideoLinksInMarkdown(rawMarkdown);

    // C. Upload ảnh bìa (nếu có gửi kèm)
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

    const plainText = (
      await mammoth.extractRawText({ buffer: wordFile.buffer })
    ).value;
    const excerpt =
      plainText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 40)[0]
        ?.slice(0, 180) + '...' ||
      'Cẩm nang kiến thức thực phẩm nhập khẩu B2B từ Khánh An Foods.';

    const wordCount = plainText.split(/\s+/).length;
    const readMinutes = Math.max(2, Math.ceil(wordCount / 220));

    const parsedTags = bodyData?.tags
      ? bodyData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
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

  // MỚI: TẠO BÀI VIẾT TRỰC TIẾP TỪ TRÌNH SOẠN THẢO MARKDOWN
  async createManual(
    bodyData: {
      title: string;
      content: string;
      category?: string;
      tags?: string;
      featured?: string;
    },
    coverImage?: Express.Multer.File,
  ) {
    if (!bodyData?.title?.trim() || !bodyData?.content?.trim()) {
      throw new BadRequestException(
        'Vui lòng nhập đầy đủ tiêu đề và nội dung bài viết',
      );
    }

    let imageUrl =
      'https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=1000&auto=format&fit=crop';
    let imagePublicId: string | null = null;

    if (coverImage) {
      const uploadedCover = await this.cloudinaryService.uploadFile(coverImage);
      imageUrl = uploadedCover.secure_url;
      imagePublicId = uploadedCover.public_id;
    }

    const finalTitle = bodyData.title.trim();
    const slug = this.generateSlug(finalTitle);
    const markdownContent = this.parseVideoLinksInMarkdown(bodyData.content);

    // Bóc tách text thuần để tạo excerpt và tính thời gian đọc
    const cleanText = markdownContent
      .replace(/<[^>]*>/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[#>*`~_-]/g, '');

    const excerpt =
      cleanText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 40)[0]
        ?.slice(0, 180) + '...' ||
      'Cẩm nang kiến thức thực phẩm nhập khẩu B2B từ Khánh An Foods.';

    const wordCount = cleanText.split(/\s+/).length;
    const readMinutes = Math.max(2, Math.ceil(wordCount / 220));

    const parsedTags = bodyData?.tags
      ? bodyData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
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

  // MỚI: CẬP NHẬT BÀI VIẾT (Hỗ trợ chèn thêm ảnh/video vào bài viết đã đăng)
  async updatePost(
    id: string,
    bodyData: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string;
      featured?: string;
    },
    coverImage?: Express.Multer.File,
  ) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy bài viết với ID ${id}`);
    }

    let imageUrl = existing.imageUrl;
    let imagePublicId = existing.imagePublicId;

    if (coverImage) {
      if (existing.imagePublicId) {
        await this.cloudinaryService.deleteFile(existing.imagePublicId);
      }
      const uploadedCover = await this.cloudinaryService.uploadFile(coverImage);
      imageUrl = uploadedCover.secure_url;
      imagePublicId = uploadedCover.public_id;
    }

    const markdownContent = bodyData.content
      ? this.parseVideoLinksInMarkdown(bodyData.content)
      : existing.content;

    const parsedTags = bodyData?.tags
      ? bodyData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : existing.tags;

    return this.prisma.post.update({
      where: { id },
      data: {
        title: bodyData.title?.trim() || existing.title,
        category: bodyData.category || existing.category,
        featured:
          bodyData.featured !== undefined
            ? bodyData.featured === 'true'
            : existing.featured,
        tags: parsedTags,
        imageUrl,
        imagePublicId,
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

  // 3. LẤY CHI TIẾT BÀI VIẾT
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

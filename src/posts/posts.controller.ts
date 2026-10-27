import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';

@Controller('api/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // POST /api/posts/import-word (Nhận file Word + ảnh bìa tùy chọn)
  @Post('import-word')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'wordFile', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  async importWord(
    @UploadedFiles()
    files: {
      wordFile?: Express.Multer.File[];
      coverImage?: Express.Multer.File[];
    },
    @Body()
    body: {
      title?: string;
      category?: string;
      tags?: string;
      featured?: string;
    },
  ) {
    return this.postsService.createFromWord(
      files?.wordFile?.[0]!,
      files?.coverImage?.[0],
      body,
    );
  }

  // GET /api/posts
  @Get()
  findAll(@Query() query: { category?: string; search?: string }) {
    return this.postsService.findAll(query);
  }

  // GET /api/posts/:slugOrId
  @Get(':slugOrId')
  findOne(@Param('slugOrId') slugOrId: string) {
    return this.postsService.findOne(slugOrId);
  }

  // DELETE /api/posts/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }
}

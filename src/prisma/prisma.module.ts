import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Đánh dấu Global để không phải import lẻ tẻ ở từng module khác
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Xuất ra cho mọi người cùng dùng
})
export class PrismaModule {}
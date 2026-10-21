import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Nhớ trỏ đúng đường dẫn file prisma.service
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  // 1. TẠO DANH BẠ MỚI
  async create(createContactDto: CreateContactDto) {
    return this.prisma.contact.create({
      data: createContactDto,
    });
  }

  // 2. LẤY DANH SÁCH TẤT CẢ DANH BẠ
  async findAll() {
    return this.prisma.contact.findMany({
      orderBy: { fullName: 'asc' }, // Sắp xếp theo tên giống file Brand
    });
  }

  // 3. LẤY THÔNG TIN CHI TIẾT 1 DANH BẠ
  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) throw new NotFoundException('Không tìm thấy danh bạ này!');
    return contact;
  }

  // 4. CẬP NHẬT THÔNG TIN DANH BẠ
  async update(id: string, updateContactDto: UpdateContactDto) {
    // Kế thừa hàm findOne để kiểm tra xem ID có tồn tại không
    await this.findOne(id);

    return this.prisma.contact.update({
      where: { id },
      data: updateContactDto,
    });
  }

  // 5. XÓA DANH BẠ
  async remove(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Không tìm thấy danh bạ này!');

    return this.prisma.contact.delete({
      where: { id },
    });
  }
}

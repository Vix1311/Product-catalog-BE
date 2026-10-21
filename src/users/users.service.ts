import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Tìm user theo email (dùng khi đăng nhập hoặc check trùng email)
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true }, // <-- Thêm dòng này để lấy dữ liệu bảng Role
    });
  }

  // Tìm user theo ID và lấy KÈM theo thông tin Role
  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true }, // <-- Thêm dòng này
    });
  }
  // Tạo user mới (dùng khi đăng ký)
  async create(data: any) {
    // Tìm role 'manager' mặc định để gán cho user mới
    const defaultRole = await this.prisma.role.findUnique({
      where: { name: 'manager' },
    });

    return this.prisma.user.create({
      data: {
        ...data,
        roleId: 3, 
      },
    });
  }

  async update(id: number, data: any) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    const { password, ...result } = updatedUser;
    return result;
  }

  async updateProfile(userId: number, data: any) {
    const { oldPassword, password, role, ...otherData } = data;

    if (password) {
      if (!oldPassword) {
        throw new BadRequestException(
          'Vui lòng cung cấp mật khẩu cũ (oldPassword) để đổi mật khẩu mới',
        );
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new UnauthorizedException('Không tìm thấy thông tin người dùng!');
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

      if (!isPasswordValid) {
        throw new BadRequestException('Mật khẩu cũ không chính xác!');
      }

      otherData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: otherData,
    });

    const { password: _, refreshToken: __, ...result } = updatedUser;
    return result;
  }
}

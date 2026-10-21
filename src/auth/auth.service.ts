import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async getTokens(userId: number, email: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      // 1. Access Token (Sống 15 phút)
      this.jwtService.signAsync(
        { id: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '15m',
        },
      ),
      // 2. Refresh Token (Sống 7 ngày)
      this.jwtService.signAsync(
        { id: userId, email, role },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async register(body: any) {
    const { email, password, name } = body;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email này đã được sử dụng!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await this.usersService.create({
      email,
      password: hashedPassword,
      name,
    });

    const { password: _, ...result } = newUser;
    return result;
  }

  async login(body: any) {
    const { email, password } = body;
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');
    }

    const tokens = await this.getTokens(
      user.id,
      user.email,
      (user as any).role?.name,
    );

    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.update(user.id, {
      refreshToken: hashedRefreshToken,
    });

    return {
      message: 'Đăng nhập thành công',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async refreshTokens(rt: string) {
    try {
      // 1. Giải mã Refresh Token bằng bí mật JWT_REFRESH_SECRET
      const payload = await this.jwtService.verifyAsync(rt, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const userId = payload.id;
      const user = await this.usersService.findById(userId);

      const refreshTokenInDb = (
        user as (typeof user & { refreshToken?: string | null }) | null
      )?.refreshToken;

      if (!user || !refreshTokenInDb) {
        throw new ForbiddenException('Truy cập bị từ chối');
      }

      // 2. So sánh chuỗi Refresh Token nhận được với Hash lưu trong DB
      const rtMatches = await bcrypt.compare(rt, refreshTokenInDb);
      if (!rtMatches) {
        throw new ForbiddenException('Truy cập bị từ chối');
      }

      // 3. Sinh cặp Token mới
      const tokens = await this.getTokens(
        user.id,
        user.email,
        (user as any).role?.name,
      );

      // 4. Lưu lại Hash Refresh Token mới vào DB
      const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
      await this.usersService.update(user.id, {
        refreshToken: hashedRefreshToken,
      });

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    } catch (error) {
      throw new ForbiddenException(
        'Refresh Token không hợp lệ hoặc đã hết hạn!',
      );
    }
  }

  async logout(userId: number) {
    await this.usersService.update(userId, { refreshToken: null });
    return { message: 'Đăng xuất thành công!' };
  }
}

import { AuthService } from './auth.service';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  // ❌ BỎ @UseGuards(AuthGuard('jwt')) Ở ĐÂY để cho phép refresh khi Access Token hết hạn
  @Post('refresh')
  async refreshTokens(
    @Body() body: { refreshToken?: string; refresh_token?: string },
  ) {
    // Hỗ trợ nhận cả refreshToken (Postman) và refresh_token
    const token = body.refreshToken || body.refresh_token;
    if (!token) {
      throw new BadRequestException('Vui lòng cung cấp Refresh Token!');
    }
    return this.authService.refreshTokens(token);
  }

  @UseGuards(AuthGuard('jwt')) // Đăng xuất vẫn giữ Guard xác thực
  @Post('logout')
  async logout(@Request() req) {
    const userId = req.user.userId;
    return this.authService.logout(userId);
  }
}

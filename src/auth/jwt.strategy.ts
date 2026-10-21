// src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'chuoi_bi_mat_du_phong_123',
    });
  }

  // Nếu Token chuẩn, hàm này sẽ chạy và trả về dữ liệu (payload)
  async validate(payload: any) {
    return { userId: payload.id, email: payload.email, role: payload.role };
  }
}

import crypto from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import type { AppConfig } from '../core/config/config.js';
import { RefreshToken, User } from '../core/entities/index.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const config = this.configService.get<AppConfig>('root')!;

    const accessToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: config.jwt.secret,
        expiresIn: config.jwt.accessTokenExpirySeconds,
      },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshTokenDays);

    const refreshToken = this.refreshTokenRepository.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    await this.refreshTokenRepository.save(refreshToken);

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async logout(refreshTokenRaw: string | undefined): Promise<void> {
    if (refreshTokenRaw) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshTokenRaw)
        .digest('hex');
      await this.refreshTokenRepository.delete({ token_hash: tokenHash });
    }
  }
}

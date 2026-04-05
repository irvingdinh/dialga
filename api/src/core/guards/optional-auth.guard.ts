import crypto from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { MoreThan, Repository } from 'typeorm';

import type { AppConfig } from '../config/config.js';
import { RefreshToken, User } from '../entities/index.js';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const config = this.configService.get<AppConfig>('root')!;

    const accessToken = request.cookies?.['access_token'];
    const refreshTokenRaw = request.cookies?.['refresh_token'];

    if (accessToken) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(accessToken, {
          secret: config.jwt.secret,
        });
        const user = await this.userRepository.findOne({
          where: { id: payload.sub },
        });
        if (user) {
          (request as Request & { user: User }).user = user;
        }
      } catch {
        // Try refresh
        if (refreshTokenRaw) {
          const tokenHash = crypto
            .createHash('sha256')
            .update(refreshTokenRaw)
            .digest('hex');
          const stored = await this.refreshTokenRepository.findOne({
            where: { token_hash: tokenHash, expires_at: MoreThan(new Date()) },
            relations: ['user'],
          });

          if (stored?.user) {
            const newAccessToken = this.jwtService.sign(
              { sub: stored.user.id },
              {
                secret: config.jwt.secret,
                expiresIn: config.jwt.accessTokenExpirySeconds,
              },
            );
            response.cookie('access_token', newAccessToken, {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              maxAge: 15 * 60 * 1000,
            });
            (request as Request & { user: User }).user = stored.user;
          }
        }
      }
    }

    return true;
  }
}

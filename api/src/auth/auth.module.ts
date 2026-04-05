import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Machine, RefreshToken, User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { OptionalAuthGuard } from '../core/guards/optional-auth.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Machine]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, OptionalAuthGuard, SeedService],
  exports: [
    AuthService,
    AuthGuard,
    OptionalAuthGuard,
    JwtModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}

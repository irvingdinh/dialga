import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import type { Request, Response } from 'express';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { AuthService } from './auth.service.js';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    return { success: true };
  }

  @Get()
  @UseGuards(AuthGuard)
  session(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshTokenRaw = req.cookies?.['refresh_token'];
    await this.authService.logout(refreshTokenRaw);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { success: true };
  }
}

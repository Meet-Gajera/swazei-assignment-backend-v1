import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<LoginResponseDto> {
    const user = await this.usersService.registerWithMerchant(dto);
    return this.buildLoginResponse(user);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const matches = await bcrypt.compare(dto.password, user.password);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    return this.buildLoginResponse(user);
  }

  private async buildLoginResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    merchantId: string;
    storeId: string | null;
  }): Promise<LoginResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      merchantId: user.merchantId,
      storeId: user.storeId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.getExpirySeconds(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as never,
        merchantId: user.merchantId,
        storeId: user.storeId,
      },
    };
  }

  private getExpirySeconds(): number {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 604800;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      default:
        return value * 86400;
    }
  }
}

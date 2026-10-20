import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../../common/enums';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.type';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  merchantId: string;
  storeId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub || !payload?.merchantId) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      merchantId: payload.merchantId,
      storeId: payload.storeId ?? null,
    };
  }
}

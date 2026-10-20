import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums';

export class RegisterDto {
  @ApiProperty({ example: 'owner@merchanta.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @ApiProperty({ example: 'Passw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ example: 'Alice Owner' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Merchant A' })
  @IsString()
  merchantName: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.MERCHANT_ADMIN })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Store to bind the user to (owner role)',
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

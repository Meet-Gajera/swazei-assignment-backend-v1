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

export class CreateUserDto {
  @ApiProperty({ example: 'cashier@merchanta.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @ApiProperty({ example: 'Passw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ example: 'Bob Cashier' })
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CASHIER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description:
      'Store the user is bound to. Required for STORE_MANAGER/CASHIER.',
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

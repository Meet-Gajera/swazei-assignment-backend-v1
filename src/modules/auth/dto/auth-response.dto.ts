import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() merchantId: string;
  @ApiProperty({ nullable: true }) storeId: string | null;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 'Bearer' }) tokenType: string;
  @ApiProperty({ example: 604800 }) expiresIn: number;
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
}

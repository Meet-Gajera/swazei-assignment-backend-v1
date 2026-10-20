import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Downtown Branch' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: '12 MG Road, Ahmedabad' })
  @IsOptional()
  @IsString()
  address?: string;
}

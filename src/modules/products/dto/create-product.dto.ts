import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Espresso' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'ESP-001' })
  @IsString()
  @MinLength(2)
  sku: string;

  @ApiPropertyOptional({ example: 'Single shot espresso' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 149.5, description: 'Price per unit (server side)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;
}

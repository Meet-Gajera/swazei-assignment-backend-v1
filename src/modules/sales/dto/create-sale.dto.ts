import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSaleItemDto {
  @ApiProperty({ description: 'Product to sell' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(1000)
  quantity: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    description:
      'Store the sale belongs to. Defaults to the store the user is bound to.',
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'a sale must contain at least one item' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiPropertyOptional({
    example: 'CARD',
    description:
      'Payment method. The mock provider decides the outcome; "fail_token" simulates a decline.',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Mock payment token, e.g. "fail_token" to force a decline',
  })
  @IsOptional()
  @IsString()
  paymentToken?: string;

  @ApiPropertyOptional({ example: 'Table 5' })
  @IsOptional()
  @IsString()
  notes?: string;
}

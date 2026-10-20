import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({ description: 'Product to adjust' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 25, description: 'New absolute quantity' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;
}

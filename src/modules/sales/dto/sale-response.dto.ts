import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, SaleStatus } from '../../../common/enums';

export class SaleItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() sku: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() lineTotal: number;
}

export class SaleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() merchantId: string;
  @ApiProperty() storeId: string;
  @ApiProperty() userId: string;
  @ApiProperty() totalAmount: number;
  @ApiProperty({ enum: SaleStatus }) status: SaleStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus: PaymentStatus;
  @ApiProperty({ nullable: true }) paymentReference: string | null;
  @ApiProperty() idempotencyKey: string;
  @ApiProperty() paymentMethod: string;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ type: [SaleItemResponseDto] }) items: SaleItemResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({
    description:
      'true when the sale was returned from the idempotency store (duplicate POS retry)',
  })
  replayed?: boolean;
}

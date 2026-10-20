import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency-key.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { SaleSummaryQueryDto } from './dto/sale-query.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a sale (requires an Idempotency-Key header for safe POS retries)',
  })
  create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: AuthenticatedUser,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.salesService.create(dto, user, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List sales (tenant + store scoped)' })
  findAll(
    @Query() query: ListSalesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.list(query, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Aggregated sales figures for a store' })
  summary(
    @Query() query: SaleSummaryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.summary(query.storeId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single sale (tenant scoped)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.findOne(id, user);
  }
}

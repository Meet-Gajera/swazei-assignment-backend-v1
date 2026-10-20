import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ListInventoryDto } from './dto/list-inventory.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'List store inventory (cached, tenant + store scoped)',
  })
  findAll(
    @Query() query: ListInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.list(query, user);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get the stock of a product in a store' })
  findOne(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('storeId') storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.findByProduct(productId, storeId, user);
  }

  @Patch()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.STORE_MANAGER)
  @ApiOperation({ summary: 'Set the absolute stock of a product in a store' })
  adjust(
    @Body() dto: AdjustInventoryDto,
    @Query('storeId') storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjust(dto, storeId, user);
  }

  @Delete(':productId')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.STORE_MANAGER)
  @ApiOperation({ summary: 'Zero out the stock of a product in a store' })
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('storeId') storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.remove(productId, storeId, user);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'List stores of the authenticated merchant' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.list(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a store (tenant scoped)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.storesService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: 'Create a store for the authenticated merchant' })
  create(@Body() dto: CreateStoreDto, @CurrentUser() user: AuthenticatedUser) {
    return this.storesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: 'Update a store' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.storesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a store' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.storesService.remove(id, user);
  }
}

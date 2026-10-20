import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { MerchantsService } from './merchants.service';

@ApiTags('merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the merchant of the authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantsService.getOwn(user);
  }
}

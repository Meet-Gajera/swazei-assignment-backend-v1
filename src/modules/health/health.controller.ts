import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness / readiness probe' })
  check() {
    return {
      status: 'ok',
      service: 'swazei-pos-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

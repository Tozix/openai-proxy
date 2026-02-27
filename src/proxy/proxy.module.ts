import { Module } from '@nestjs/common';
import { GrsaiController } from './grsai.controller';
import { KieController } from './kie.controller';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  controllers: [ProxyController, GrsaiController, KieController],
  providers: [ProxyService],
})
export class ProxyModule {}

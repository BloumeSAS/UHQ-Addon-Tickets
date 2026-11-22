import { Module } from '@nestjs/common';
import { PanelAuthService } from '../auth/panel-auth.service';
import { PanelMailClient } from './mail.client';
import { StoreService } from './store.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  providers: [StoreService, PanelAuthService, PanelMailClient, TicketsService],
  controllers: [TicketsController],
  exports: [StoreService, PanelAuthService],
})
export class TicketsModule {}

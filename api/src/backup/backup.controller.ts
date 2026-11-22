import { Body, Controller, Get, Headers, Logger, Post } from '@nestjs/common';
import { PanelAuthService } from '../auth/panel-auth.service';
import { StoreService } from '../tickets/store.service';

/** Sauvegarde / restauration pour le panel (déclaré dans uhq-manifest.json). Auth : X-Panel-Key. Les pièces jointes ne sont pas incluses (fichiers). */
@Controller('api/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly store: StoreService, private readonly auth: PanelAuthService) {}

  @Get('export')
  export(@Headers('x-panel-key') key: string) {
    this.auth.requirePanelKey(key);
    return { ...this.store.exportData(), exportedAt: new Date().toISOString() };
  }

  @Post('import')
  import(@Headers('x-panel-key') key: string, @Body() body: any) {
    this.auth.requirePanelKey(key);
    const tickets: Record<string, any> = {};
    for (const t of Object.values(body?.tickets ?? {}) as any[]) if (t && typeof t.id === 'string' && Array.isArray(t.messages)) tickets[t.id] = t;
    const macros: Record<string, any> = {};
    for (const m of Object.values(body?.macros ?? {}) as any[]) if (m && typeof m.id === 'string') macros[m.id] = m;
    this.store.restore({ counter: body?.counter, tickets, macros, settings: body?.settings });
    this.logger.log(`Backup import: ${Object.keys(tickets).length} tickets`);
    return { success: true, restored: Object.keys(tickets).length };
  }
}

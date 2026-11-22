import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { PanelAuthService } from '../auth/panel-auth.service';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, MacroDto, RateDto, ReplyDto, SettingsDto, StaffReplyDto, UpdateTicketDto } from './tickets.dto';

const SAFE_ID = /^[0-9a-f-]{36}$/;

@Controller('api')
export class TicketsController {
  constructor(private readonly svc: TicketsService, private readonly auth: PanelAuthService) {}

  // ─── Client ──────────────────────────────────────────────────────────────────

  /** GET /api/me — rôle vérifié par le panel + réglages publics (catégories, pièces jointes). */
  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.auth.authenticate(req);
    return { staff: user.role === 'ADMIN' || user.role === 'SUPPORT', admin: user.role === 'ADMIN', email: user.email, settings: this.svc.publicSettings() };
  }

  @Get('tickets')
  async mine(@Req() req: Request) {
    const user = await this.auth.authenticate(req);
    return { tickets: this.svc.listMine(user) };
  }

  @Post('tickets')
  @HttpCode(200)
  async create(@Req() req: Request, @Body() dto: CreateTicketDto) {
    const user = await this.auth.authenticate(req);
    return { ticket: this.svc.create(user, dto) };
  }

  @Get('tickets/:id')
  async getMine(@Req() req: Request, @Param('id') id: string) {
    const user = await this.auth.authenticate(req);
    return { ticket: this.svc.getMine(user, id) };
  }

  @Post('tickets/:id/reply')
  @HttpCode(200)
  async reply(@Req() req: Request, @Param('id') id: string, @Body() dto: ReplyDto) {
    const user = await this.auth.authenticate(req);
    return { ticket: this.svc.reply(user, id, dto) };
  }

  @Post('tickets/:id/close')
  @HttpCode(200)
  async close(@Req() req: Request, @Param('id') id: string) {
    const user = await this.auth.authenticate(req);
    return { ticket: this.svc.close(user, id) };
  }

  @Post('tickets/:id/rate')
  @HttpCode(200)
  async rate(@Req() req: Request, @Param('id') id: string, @Body() dto: RateDto) {
    const user = await this.auth.authenticate(req);
    return { ticket: this.svc.rate(user, id, dto.score, dto.comment) };
  }

  /** GET /api/tickets/:id/files/:fileId — pièce jointe (propriétaire ou personnel), toujours en téléchargement. */
  @Get('tickets/:id/files/:fileId')
  async file(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Param('fileId') fileId: string) {
    const user = await this.auth.authenticate(req);
    if (!SAFE_ID.test(fileId)) return res.status(404).json({ message: 'FILE_NOT_FOUND' });
    const staff = user.role === 'ADMIN' || user.role === 'SUPPORT';
    const { file, meta } = this.svc.attachment(user, staff, id, fileId);
    if (!fs.existsSync(file)) return res.status(404).json({ message: 'FILE_NOT_FOUND' });
    res.setHeader('Content-Type', meta.type);
    res.setHeader('Content-Length', String(meta.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`);
    fs.createReadStream(file).pipe(res);
  }

  // ─── Personnel (ADMIN + SUPPORT) ─────────────────────────────────────────────

  @Get('staff/overview')
  async overview(@Req() req: Request) {
    await this.auth.requireStaff(req);
    return this.svc.overview();
  }

  @Get('staff/tickets')
  async list(
    @Req() req: Request, @Query('status') status?: string, @Query('q') q?: string, @Query('category') category?: string,
    @Query('priority') priority?: string, @Query('assignee') assignee?: string, @Query('mine') mine?: string,
    @Query('unread') unread?: string, @Query('limit') limit?: string, @Query('offset') offset?: string,
  ) {
    const user = await this.auth.requireStaff(req);
    return this.svc.list({
      status, q: q?.slice(0, 80), category, priority, assignee, mine: mine === '1', unread: unread === '1',
      limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined,
    }, user);
  }

  @Get('staff/tickets/:id')
  async getStaff(@Req() req: Request, @Param('id') id: string) {
    await this.auth.requireStaff(req);
    return { ticket: this.svc.getStaff(id) };
  }

  @Post('staff/tickets/:id/reply')
  @HttpCode(200)
  async staffReply(@Req() req: Request, @Param('id') id: string, @Body() dto: StaffReplyDto) {
    const user = await this.auth.requireStaff(req);
    return { ticket: this.svc.staffReply(user, id, dto) };
  }

  @Patch('staff/tickets/:id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTicketDto) {
    const user = await this.auth.requireStaff(req);
    return { ticket: this.svc.update(user, id, dto) };
  }

  @Delete('staff/tickets/:id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.auth.requireAdmin(req);
    this.svc.remove(id);
    return { success: true };
  }

  @Get('staff/macros')
  async macros(@Req() req: Request) {
    await this.auth.requireStaff(req);
    return { macros: this.svc.macros() };
  }

  @Post('staff/macros')
  @HttpCode(200)
  async createMacro(@Req() req: Request, @Body() dto: MacroDto) {
    await this.auth.requireAdmin(req);
    return { macro: this.svc.saveMacro(dto) };
  }

  @Put('staff/macros/:id')
  async updateMacro(@Req() req: Request, @Param('id') id: string, @Body() dto: MacroDto) {
    await this.auth.requireAdmin(req);
    return { macro: this.svc.saveMacro(dto, id) };
  }

  @Delete('staff/macros/:id')
  async deleteMacro(@Req() req: Request, @Param('id') id: string) {
    await this.auth.requireAdmin(req);
    this.svc.deleteMacro(id);
    return { success: true };
  }

  @Get('staff/settings')
  async settings(@Req() req: Request) {
    await this.auth.requireStaff(req);
    return { settings: this.svc.currentSettings() };
  }

  @Put('staff/settings')
  async updateSettings(@Req() req: Request, @Body() dto: SettingsDto) {
    await this.auth.requireAdmin(req);
    return { settings: this.svc.updateSettings(dto) };
  }
}

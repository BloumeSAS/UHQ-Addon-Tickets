import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class AttachmentDto {
  @IsString() @Length(1, 120) name!: string;
  @IsString() @MaxLength(60) type!: string;
  /** Contenu en base64 (sans préfixe data:). ~2,8 Mo de base64 = 2 Mo de fichier. */
  @IsString() @MaxLength(3_000_000) data!: string;
}

export class CreateTicketDto {
  @IsString() @Length(3, 160) subject!: string;
  @IsString() @Length(1, 80) category!: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsString() @MaxLength(120) account?: string;
  @IsString() @Length(1, 10_000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}

export class ReplyDto {
  @IsString() @Length(1, 10_000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}

export class StaffReplyDto extends ReplyDto {
  @IsOptional() @IsBoolean() internal?: boolean;
  /** Statut à appliquer avec la réponse (défaut : « répondu »). */
  @IsOptional() @IsIn(['open', 'answered', 'resolved', 'closed']) status?: string;
}

export class RateDto {
  @IsInt() @Min(1) @Max(5) score!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsIn(['open', 'answered', 'resolved', 'closed']) status?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsString() @Length(1, 80) category?: string;
  /** 'me' = s'attribuer le ticket, 'none' = le libérer. */
  @IsOptional() @IsIn(['me', 'none']) assignee?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
}

export class MacroDto {
  @IsString() @Length(1, 80) title!: string;
  @IsString() @Length(1, 5000) body!: string;
}

export class SettingsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) categories?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(365) auto_close_days?: number;
  @IsOptional() @IsBoolean() allow_attachments?: boolean;
  @IsOptional() @IsBoolean() notify_customer?: boolean;
  @IsOptional() @IsBoolean() notify_admins?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(200) max_open_per_user?: number;
  @IsOptional() @IsString() @MaxLength(2000) auto_reply?: string;
  @IsOptional() @IsString() @MaxLength(1000) signature?: string;
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import { CreateImportDto } from './dto/create-import.dto';
import { ImportsService } from './imports.service';
import { RequirePlatformAdmin } from 'src/admin/decorators/admin-role.decorator';

const IMPORT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'imports');
const MAX_IMPORT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

mkdirSync(IMPORT_UPLOAD_DIR, { recursive: true });

/**
 * Controller exposing admin import endpoints.
 */
@ApiTags('Admin Imports')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
@UseGuards(AdminAuthGuard)
@RequirePlatformAdmin()
@Controller('admin/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  /**
   * Uploads a catalog CSV file and starts an in-process background import.
   */
  @Post()
  @ApiOperation({ summary: 'Upload catalog import CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
        type: { type: 'string', enum: ['catalog_items'] },
        mode: {
          type: 'string',
          enum: ['create_only', 'upsert', 'update_only', 'replace_source'],
        },
        catalogType: {
          type: 'string',
          enum: ['grocery', 'pharmacy'],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Import run created successfully',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'images', maxCount: 1000 },
      ],
      {
        storage: diskStorage({
          destination: (req: any, file, callback) => {
            if (!req.importSessionId) {
              req.importSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            }
            const dest = join(IMPORT_UPLOAD_DIR, req.importSessionId);
            mkdirSync(dest, { recursive: true });

            if (file.fieldname === 'images') {
              const imagesDest = join(dest, 'images');
              mkdirSync(imagesDest, { recursive: true });
              callback(null, imagesDest);
            } else {
              callback(null, dest);
            }
          },
          filename: (_req, file, callback) => {
            const ext = extname(file.originalname);
            const nameWithoutExt = file.originalname.substring(0, file.originalname.length - ext.length);
            const safeName = Buffer.from(nameWithoutExt).toString('hex') + ext;
            if (file.fieldname === 'file') {
              callback(null, `${Date.now()}-${safeName}`);
            } else {
              callback(null, safeName);
            }
          },
        }),
        limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
        fileFilter: (_req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          if (file.fieldname === 'file' && extension !== '.csv') {
            callback(
              new BadRequestException(
                'Only CSV files are supported for the catalog file',
              ),
              false,
            );
            return;
          }
          if (
            file.fieldname === 'images' &&
            !['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(extension)
          ) {
            callback(
              new BadRequestException(`Unsupported image format: ${extension}`),
              false,
            );
            return;
          }
          callback(null, true);
        },
      },
    ),
  )
  createImport(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; images?: Express.Multer.File[] },
    @Body() body: CreateImportDto,
  ) {
    if (!files || !files.file || files.file.length === 0) {
      throw new BadRequestException('Import file is required');
    }

    return this.importsService.createImport(
      files.file[0],
      body,
      files.images || [],
    );
  }

  /**
   * Lists recent import runs.
   */
  @Get()
  @ApiOperation({ summary: 'List import runs' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return import runs' })
  findAll() {
    return this.importsService.findAll();
  }

  /**
   * Returns a single import run.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get import run details' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return import run' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.findOne(id);
  }

  /**
   * Lists row errors for an import run.
   */
  @Get(':id/errors')
  @ApiOperation({ summary: 'Get import row errors' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return import errors' })
  findErrors(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.findErrors(id);
  }

  /**
   * Cancels a running import run.
   */
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a running import run' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Import cancelled successfully',
  })
  cancelImport(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.cancelImport(id);
  }
}

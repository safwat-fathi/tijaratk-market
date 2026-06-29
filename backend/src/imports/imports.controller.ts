import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
        type: { type: 'string', enum: ['catalog_items'] },
        mode: {
          type: 'string',
          enum: ['create_only', 'upsert', 'update_only', 'replace_source'],
        },
        format: {
          type: 'string',
          enum: ['talabat', 'chefaa', 'carrefour'],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Import run created successfully',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      // Admin-only local storage under uploads/imports; filenames are sanitized.
      // eslint-disable-next-line sonarjs/content-length
      storage: diskStorage({
        destination: IMPORT_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
          callback(null, `${Date.now()}-${safeName}`);
        },
      }),
      limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (extension !== '.csv') {
          callback(
            new BadRequestException('Only CSV files are supported'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  createImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: CreateImportDto,
  ) {
    if (!file) {
      throw new BadRequestException('Import file is required');
    }

    return this.importsService.createImport(file, body);
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
  @ApiResponse({ status: HttpStatus.OK, description: 'Import cancelled successfully' })
  cancelImport(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.cancelImport(id);
  }
}

import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { join } from 'path';
import { mkdirSync } from 'fs';

/**
 * Reusable file upload decorator built on top of Multer's FileInterceptor.
 * Stores uploads under ./uploads by default.
 */
export function UploadFile(
  fieldName: string = 'file',
  options: Partial<MulterOptions> = {},
) {
  const uploadDir =
    typeof options.dest === 'string' ? options.dest : join(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });

  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        dest: uploadDir,
        ...options,
      }),
    ),
  );
}

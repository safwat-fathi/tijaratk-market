import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { extname } from 'path';

type MulterLikeFile = {
  mimetype?: string;
  originalname?: string;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
]);

const UNSUPPORTED_IMAGE_FORMAT_MESSAGE =
  'Unsupported image format. Use JPG, PNG, WEBP, HEIC, or HEIF.';
const UNSUPPORTED_PRESCRIPTION_FORMAT_MESSAGE =
  'Unsupported prescription file format. Use JPG, PNG, WEBP, HEIC, HEIF, or PDF.';

/**
 * Multer file filter that accepts common web image MIME types only.
 */
export const imageFileFilter = (
  _req: Request,
  file: MulterLikeFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const mimeType = file.mimetype?.trim().toLowerCase() || '';

  if (ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    callback(null, true);
    return;
  }

  const fileExtension = extname(file.originalname || '').toLowerCase();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.has(fileExtension);
  const hasGenericMimeType =
    !mimeType || mimeType === 'application/octet-stream';

  if (!(hasGenericMimeType && hasAllowedExtension)) {
    return callback(
      new BadRequestException(UNSUPPORTED_IMAGE_FORMAT_MESSAGE),
      false,
    );
  }

  callback(null, true);
};

/**
 * Multer file filter for prescription uploads. Accepts common phone image
 * formats plus PDF because the storefront currently advertises PDF support.
 */
export const prescriptionFileFilter = (
  _req: Request,
  file: MulterLikeFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const mimeType = file.mimetype?.trim().toLowerCase() || '';

  if (ALLOWED_IMAGE_MIME_TYPES.has(mimeType) || mimeType === 'application/pdf') {
    callback(null, true);
    return;
  }

  const fileExtension = extname(file.originalname || '').toLowerCase();
  const hasAllowedExtension =
    ALLOWED_IMAGE_EXTENSIONS.has(fileExtension) || fileExtension === '.pdf';
  const hasGenericMimeType =
    !mimeType || mimeType === 'application/octet-stream';

  if (!(hasGenericMimeType && hasAllowedExtension)) {
    return callback(
      new BadRequestException(UNSUPPORTED_PRESCRIPTION_FORMAT_MESSAGE),
      false,
    );
  }

  callback(null, true);
};

const UNSUPPORTED_CSV_FORMAT_MESSAGE = 'Unsupported file format. Please upload a CSV file.';
const UNSUPPORTED_PRODUCT_SPREADSHEET_FORMAT_MESSAGE =
  'الصيغة غير مدعومة. استخدم ملف CSV أو XLSX';

/**
 * Multer file filter for CSV uploads.
 */
export const csvFileFilter = (
  _req: Request,
  file: MulterLikeFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const mimeType = file.mimetype?.trim().toLowerCase() || '';
  const fileExtension = extname(file.originalname || '').toLowerCase();

  if (
    mimeType === 'text/csv' || 
    mimeType === 'application/csv' || 
    mimeType === 'application/vnd.ms-excel' ||
    fileExtension === '.csv'
  ) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException(UNSUPPORTED_CSV_FORMAT_MESSAGE),
    false,
  );
};

const PRODUCT_SPREADSHEET_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

/**
 * Multer file filter for mapped product imports.
 * Accepts modern XLSX workbooks and CSV files only.
 */
export const productSpreadsheetFileFilter = (
  _req: Request,
  file: MulterLikeFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const mimeType = file.mimetype?.trim().toLowerCase() || '';
  const fileExtension = extname(file.originalname || '').toLowerCase();
  const hasAllowedExtension =
    fileExtension === '.csv' || fileExtension === '.xlsx';
  const hasAllowedMimeType =
    !mimeType || PRODUCT_SPREADSHEET_MIME_TYPES.has(mimeType);

  if (hasAllowedExtension && hasAllowedMimeType) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException(
      UNSUPPORTED_PRODUCT_SPREADSHEET_FORMAT_MESSAGE,
    ),
    false,
  );
};

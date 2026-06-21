import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ImageProcessorService } from 'src/common/services/image-processor.service';

@Injectable()
export class ImageDownloaderService {
  private readonly logger = new Logger(ImageDownloaderService.name);

  constructor(private readonly imageProcessorService: ImageProcessorService) {}

  /**
   * Downloads an image from an external URL to a temporary file.
   *
   * @param url The external URL to download from.
   * @returns Absolute path to the downloaded temporary file, or null if download failed.
   */
  async downloadImage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        this.logger.warn(
          `Failed to download image from ${url}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        this.logger.warn(`Invalid content type from ${url}: ${contentType}`);
        return null;
      }

      const tempFileName = `catalog-import-${Date.now()}-${Math.random().toString(36).substring(7)}.tmp`;
      const tempFilePath = path.join(os.tmpdir(), tempFileName);

      const arrayBuffer = await response.arrayBuffer();
      await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

      // Process the image using Sharp to resize and convert to WebP
      try {
        const processedUrl = await this.imageProcessorService.processProductThumbnail(tempFilePath);
        return processedUrl;
      } catch (processError) {
        this.logger.error(
          `Failed to process downloaded image from ${url}:`,
          processError instanceof Error ? processError.message : String(processError),
        );
        // tempFilePath is deleted by processProductThumbnail internally even on error
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Error downloading image from ${url}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }
}

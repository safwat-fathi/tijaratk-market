import { Injectable, Logger } from '@nestjs/common';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import {
  isCatalogImageReferenceAllowedForSource,
  type CatalogSource,
} from 'src/products/catalog-source-policy';
import { ImageDownloaderService } from './image-downloader.service';

export type ExistingCatalogImageState = {
  image_url?: string | null;
  original_image_url?: string | null;
};

export type ResolvedCatalogImageState = {
  finalImageUrl: string | null;
  finalOriginalImageUrl: string | null;
};

type ProcessExternalCatalogImageInput = {
  source: CatalogSource;
  incomingExternalUrl: string | null;
  existingItem?: ExistingCatalogImageState | null;
};

/**
 * Validates and downloads external catalog images without persisting a failed
 * or unsupported remote URL as the product image fallback.
 */
@Injectable()
export class CatalogImportImageService {
  private readonly logger = new Logger(CatalogImportImageService.name);

  constructor(
    private readonly imageDownloaderService: ImageDownloaderService,
    private readonly imageProcessorService: ImageProcessorService,
  ) {}

  async processExternalImage({
    source,
    incomingExternalUrl,
    existingItem,
  }: ProcessExternalCatalogImageInput): Promise<ResolvedCatalogImageState> {
    if (!incomingExternalUrl) {
      return { finalImageUrl: null, finalOriginalImageUrl: null };
    }

    const existingState = this.preserveExistingImage(existingItem);
    if (
      !isCatalogImageReferenceAllowedForSource(source, incomingExternalUrl)
    ) {
      this.logger.warn(
        `Skipped unsupported catalog image host for ${source}: ${this.describeHost(incomingExternalUrl)}`,
      );
      return existingState;
    }

    if (
      existingItem?.image_url &&
      incomingExternalUrl === existingItem.original_image_url
    ) {
      return existingState;
    }

    const processedUrl =
      await this.imageDownloaderService.downloadImage(incomingExternalUrl);
    if (!processedUrl) {
      this.logger.warn(
        `Skipped unavailable catalog image for ${source}: ${this.describeHost(incomingExternalUrl)}`,
      );
      return existingState;
    }

    if (existingItem?.image_url && existingItem.image_url !== processedUrl) {
      await this.imageProcessorService.deleteManagedProductImage(
        existingItem.image_url,
      );
    }

    return {
      finalImageUrl: processedUrl,
      finalOriginalImageUrl: incomingExternalUrl,
    };
  }

  private preserveExistingImage(
    existingItem?: ExistingCatalogImageState | null,
  ): ResolvedCatalogImageState {
    return {
      finalImageUrl: existingItem?.image_url || null,
      finalOriginalImageUrl: existingItem?.original_image_url || null,
    };
  }

  private describeHost(imageUrl: string): string {
    try {
      return new URL(imageUrl).hostname || 'invalid-url';
    } catch {
      return 'invalid-url';
    }
  }
}

import { Test, type TestingModule } from '@nestjs/testing';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { CATALOG_SOURCE_TALABAT } from 'src/products/catalog-source-policy';
import { CatalogImportImageService } from './catalog-import-image.service';
import { ImageDownloaderService } from './image-downloader.service';

describe('CatalogImportImageService', () => {
  let service: CatalogImportImageService;
  let imageDownloaderService: jest.Mocked<
    Pick<ImageDownloaderService, 'downloadImage'>
  >;
  let imageProcessorService: jest.Mocked<
    Pick<ImageProcessorService, 'deleteManagedProductImage'>
  >;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogImportImageService,
        {
          provide: ImageDownloaderService,
          useValue: { downloadImage: jest.fn() },
        },
        {
          provide: ImageProcessorService,
          useValue: { deleteManagedProductImage: jest.fn() },
        },
      ],
    }).compile();

    service = testingModule.get(CatalogImportImageService);
    imageDownloaderService = testingModule.get(
      ImageDownloaderService,
    ) as jest.Mocked<Pick<ImageDownloaderService, 'downloadImage'>>;
    imageProcessorService = testingModule.get(
      ImageProcessorService,
    ) as jest.Mocked<
      Pick<ImageProcessorService, 'deleteManagedProductImage'>
    >;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('stores a successfully downloaded image and its original URL', async () => {
    const incomingExternalUrl =
      'https://talabat.dhmedia.io/image/product.jpg';
    imageDownloaderService.downloadImage.mockResolvedValue(
      '/uploads/products/new.webp',
    );

    await expect(
      service.processExternalImage({
        source: CATALOG_SOURCE_TALABAT,
        incomingExternalUrl,
        existingItem: {
          image_url: '/uploads/products/old.webp',
          original_image_url:
            'https://talabat.dhmedia.io/image/old-product.jpg',
        },
      }),
    ).resolves.toEqual({
      finalImageUrl: '/uploads/products/new.webp',
      finalOriginalImageUrl: incomingExternalUrl,
    });
    expect(
      imageProcessorService.deleteManagedProductImage,
    ).toHaveBeenCalledWith('/uploads/products/old.webp');
  });

  it('imports a new item without an image when the host is rejected', async () => {
    await expect(
      service.processExternalImage({
        source: CATALOG_SOURCE_TALABAT,
        incomingExternalUrl: 'https://www.google.com/search?q=product',
      }),
    ).resolves.toEqual({
      finalImageUrl: null,
      finalOriginalImageUrl: null,
    });
    expect(imageDownloaderService.downloadImage).not.toHaveBeenCalled();
  });

  it('imports a new item without an image when download fails', async () => {
    imageDownloaderService.downloadImage.mockResolvedValue(null);

    await expect(
      service.processExternalImage({
        source: CATALOG_SOURCE_TALABAT,
        incomingExternalUrl:
          'https://talabat.dhmedia.io/image/unavailable.jpg',
      }),
    ).resolves.toEqual({
      finalImageUrl: null,
      finalOriginalImageUrl: null,
    });
  });

  it('preserves an existing image when a replacement download fails', async () => {
    imageDownloaderService.downloadImage.mockResolvedValue(null);

    await expect(
      service.processExternalImage({
        source: CATALOG_SOURCE_TALABAT,
        incomingExternalUrl:
          'https://talabat.dhmedia.io/image/unavailable.jpg',
        existingItem: {
          image_url: '/uploads/products/existing.webp',
          original_image_url:
            'https://talabat.dhmedia.io/image/existing.jpg',
        },
      }),
    ).resolves.toEqual({
      finalImageUrl: '/uploads/products/existing.webp',
      finalOriginalImageUrl:
        'https://talabat.dhmedia.io/image/existing.jpg',
    });
  });

  it('clears existing image state for an explicitly blank import value', async () => {
    await expect(
      service.processExternalImage({
        source: CATALOG_SOURCE_TALABAT,
        incomingExternalUrl: null,
        existingItem: {
          image_url: '/uploads/products/existing.webp',
          original_image_url:
            'https://talabat.dhmedia.io/image/existing.jpg',
        },
      }),
    ).resolves.toEqual({
      finalImageUrl: null,
      finalOriginalImageUrl: null,
    });
  });
});

import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
  isCatalogImageReferenceAllowedForSource,
} from './catalog-source-policy';

describe('catalog image source policy', () => {
  const isAllowed = (source: string, imageReference: string) =>
    isCatalogImageReferenceAllowedForSource(source, imageReference, null);

  it.each([
    'https://cdn.mafrservices.com/sys-master-root/product.jpg',
    'https://talabat.dhmedia.io/image/product.jpg',
    'https://images.deliveryhero.io/image/product.jpg',
  ])('accepts grocery provider image %s', (imageReference) => {
    expect(isAllowed(CATALOG_SOURCE_TALABAT, imageReference)).toBe(true);
  });

  it('accepts the pharmacy provider for pharmacy catalog items', () => {
    expect(
      isAllowed(
        CATALOG_SOURCE_CHEFAA,
        'https://cdn.chefaa.com/public/product.webp',
      ),
    ).toBe(true);
  });

  it('keeps grocery and pharmacy provider hosts isolated', () => {
    expect(
      isAllowed(
        CATALOG_SOURCE_TALABAT,
        'https://cdn.chefaa.com/public/product.webp',
      ),
    ).toBe(false);
    expect(
      isAllowed(
        CATALOG_SOURCE_CHEFAA,
        'https://talabat.dhmedia.io/image/product.jpg',
      ),
    ).toBe(false);
  });

  it('accepts managed product uploads for both catalog sources', () => {
    expect(
      isAllowed(
        CATALOG_SOURCE_TALABAT,
        '/uploads/products/product.webp',
      ),
    ).toBe(true);
    expect(
      isAllowed(
        CATALOG_SOURCE_CHEFAA,
        '/uploads/products/product.webp',
      ),
    ).toBe(true);
  });

  it('accepts the configured HTTPS API host', () => {
    expect(
      isCatalogImageReferenceAllowedForSource(
        CATALOG_SOURCE_TALABAT,
        'https://api.tijaratk.test/uploads/products/product.webp',
        'https://api.tijaratk.test',
      ),
    ).toBe(true);
  });

  it('accepts HTTP only for local development hosts', () => {
    expect(
      isAllowed(
        CATALOG_SOURCE_TALABAT,
        'http://localhost:8000/uploads/products/product.webp',
      ),
    ).toBe(true);
    expect(
      isAllowed(
        CATALOG_SOURCE_TALABAT,
        'http://cdn.mafrservices.com/product.jpg',
      ),
    ).toBe(false);
  });

  it.each([
    'https://www.google.com/search?q=product+image',
    'not-a-url',
    'data:image/png;base64,abc',
    'javascript:alert(1)',
  ])('rejects unsupported image reference %s', (imageReference) => {
    expect(isAllowed(CATALOG_SOURCE_TALABAT, imageReference)).toBe(false);
  });

  it('enforces provider path restrictions', () => {
    expect(
      isAllowed(
        CATALOG_SOURCE_TALABAT,
        'https://talabat.dhmedia.io/not-an-image/product.jpg',
      ),
    ).toBe(false);
  });

  it('rejects traversal outside the managed uploads directory', () => {
    expect(
      isAllowed(
        CATALOG_SOURCE_TALABAT,
        '/uploads/products/../private/file.webp',
      ),
    ).toBe(false);
  });
});

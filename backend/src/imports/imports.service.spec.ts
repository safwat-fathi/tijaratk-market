/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { ImportsService } from './imports.service';
import { CatalogImportFormat } from './schemas/catalog-import-row.schema';

describe('ImportsService catalog source policy', () => {
  const service = new ImportsService({} as any, {} as any, {} as any);

  it('rejects Chefaa rows that normalize to supermarket categories', () => {
    expect(() =>
      (service as any).mapCatalogRow({
        format: CatalogImportFormat.chefaa,
        data: {
          name: 'Imported rice',
          price: '10',
          currency: 'EGP',
          product_id: 'rice-1',
          category_path: 'أرز , مكرونة والبقوليات > أرز',
        },
      }),
    ).toThrow('Category أرز ومكرونة is not allowed for chefaa_csv');
  });

  it('keeps valid Chefaa pharmacy rows importable', () => {
    const item = (service as any).mapCatalogRow({
      format: CatalogImportFormat.chefaa,
      data: {
        name: 'Panadol',
        price: '25',
        currency: 'EGP',
        product_id: 'panadol-1',
        category_path: 'الأدوية > مسكنات',
      },
    });

    expect(item).toEqual(
      expect.objectContaining({
        name: 'Panadol',
        category: 'أدوية',
        source: 'chefaa_csv',
        external_id: 'panadol-1',
      }),
    );
  });

  it('normalizes raw Carrefour grocery categories to allowed supermarket categories', () => {
    const item = (service as any).mapCatalogRow({
      format: CatalogImportFormat.carrefour,
      data: {
        name: 'Imported rice',
        price: '45',
        currency: 'EGP',
        product_id: 'carrefour-rice-1',
        category_title_ar: 'أرز , مكرونة والبقوليات',
      },
    });

    expect(item).toEqual(
      expect.objectContaining({
        name: 'Imported rice',
        category: 'أرز ومكرونة',
        source: 'talabat_csv',
        external_id: 'carrefour-rice-1',
      }),
    );
  });

  it('normalizes raw Talabat category paths to allowed supermarket categories', () => {
    const item = (service as any).mapCatalogRow({
      format: CatalogImportFormat.talabat,
      data: {
        name: 'Imported tea',
        price: '80',
        currency: 'EGP',
        product_id: 'talabat-tea-1',
        category: 'قهوة وشاي > شاي أسود',
      },
    });

    expect(item).toEqual(
      expect.objectContaining({
        name: 'Imported tea',
        category: 'مشروبات',
        source: 'talabat_csv',
        external_id: 'talabat-tea-1',
      }),
    );
  });

  it('normalizes known broad grocery parents to the grocery fallback category', () => {
    const item = (service as any).mapCatalogRow({
      format: CatalogImportFormat.carrefour,
      data: {
        name: 'Cooking ingredient',
        price: '15',
        currency: 'EGP',
        product_id: 'cooking-ingredient-1',
        category_title_ar: 'مكونات الطبخ',
      },
    });

    expect(item).toEqual(
      expect.objectContaining({
        name: 'Cooking ingredient',
        category: 'أخرى',
        source: 'talabat_csv',
      }),
    );
  });

  it('rejects unmapped grocery source categories instead of falling back to other', () => {
    expect(() =>
      (service as any).mapCatalogRow({
        format: CatalogImportFormat.carrefour,
        data: {
          name: 'Unknown imported product',
          price: '10',
          currency: 'EGP',
          product_id: 'unknown-1',
          category_title_ar: 'منتجات من كل أنحاء العالم',
        },
      }),
    ).toThrow('Category منتجات من كل أنحاء العالم is not allowed for talabat_csv');
  });

  it('rejects Talabat rows that normalize to pharmacy-only categories', () => {
    expect(() =>
      (service as any).mapCatalogRow({
        format: CatalogImportFormat.talabat,
        data: {
          name: 'Imported medicine',
          price: '10',
          currency: 'EGP',
          product_id: 'medicine-1',
          category: 'أدوية',
        },
      }),
    ).toThrow('Category أدوية is not allowed for talabat_csv');
  });
});

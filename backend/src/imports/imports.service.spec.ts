/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { ImportsService } from './imports.service';
import { CatalogImportFormat } from './schemas/catalog-import-row.schema';

describe('ImportsService catalog source policy', () => {
  const service = new ImportsService({} as any);

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
});

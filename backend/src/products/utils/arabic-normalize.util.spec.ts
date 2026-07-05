import { arabicNormalize } from './arabic-normalize.util';

describe('arabicNormalize', () => {
  it.each([
    ['أرز', 'ارز'],
    ['إرز', 'ارز'],
    ['آرز', 'ارز'],
    ['ٱرز', 'ارز'],
    ['شاى', 'شاي'],
    ['اية', 'ايه'],
    ['آيه', 'ايه'],
    ['اَيَةـ', 'ايه'],
  ])('normalizes Arabic spelling variants: %s', (input, expected) => {
    expect(arabicNormalize(input)).toBe(expected);
  });

  it('preserves existing product-search cleanup rules', () => {
    expect(arabicNormalize('الزبادي (عرض خاص) 105 جم - سادة')).toBe(
      'زبادي ساده',
    );
  });

  it('collapses repeated whitespace and trims the result', () => {
    expect(arabicNormalize('  آيه   500 جم  ')).toBe('ايه');
  });
});

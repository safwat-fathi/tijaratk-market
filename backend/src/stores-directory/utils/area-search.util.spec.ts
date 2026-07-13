import {
  normalizeAreaSearchValue,
  rankAreaSearchResults,
} from './area-search.util';

type TestArea = {
  id: number;
  name_ar: string;
  name_en: string | null;
  slug: string;
};

const octoberArea: TestArea = {
  id: 1,
  name_ar: '6 أكتوبر',
  name_en: '6th of October',
  slug: '6th-of-october',
};

const octoberGardensArea: TestArea = {
  id: 2,
  name_ar: 'حدائق أكتوبر',
  name_en: 'Hadayek October',
  slug: 'hadayek-october',
};

const sheikhZayedArea: TestArea = {
  id: 3,
  name_ar: 'الشيخ زايد',
  name_en: 'Sheikh Zayed',
  slug: 'sheikh-zayed',
};

const northernExpansionsArea: TestArea = {
  id: 4,
  name_ar: 'التوسعات الشمالية',
  name_en: null,
  slug: 'october-northern-expansions',
};

describe('normalizeAreaSearchValue', () => {
  it('normalizes Arabic marks, letter forms, punctuation, and both Arabic digit sets', () => {
    expect(normalizeAreaSearchValue(' ٦ أُكْتُـوبَر، ۰۲ ')).toBe(
      '6 اكتوبر 02',
    );
    expect(normalizeAreaSearchValue('آيَة مُؤْمِن')).toBe('ايه مومن');
  });
});

describe('rankAreaSearchResults', () => {
  const areas = [octoberArea, octoberGardensArea, sheikhZayedArea];

  it.each([
    '6 أكتوبر',
    '٦ أكتوبر',
    '6 اكتوبر',
    '٦ اكتوبر',
    'اكتوبر',
    'اكتبر',
  ])('ranks 6 October first for %s', (query) => {
    const results = rankAreaSearchResults(areas, query, 20);

    expect(results[0]).toBe(octoberArea);
  });

  it('ranks an exact normalized name above an earlier substring match', () => {
    const octoberExtensionArea: TestArea = {
      ...octoberGardensArea,
      name_ar: 'امتداد 6 أكتوبر',
    };
    const results = rankAreaSearchResults(
      [octoberExtensionArea, octoberArea],
      '٦ اكتوبر',
      20,
    );

    expect(results.map((area) => area.id)).toEqual([
      octoberArea.id,
      octoberExtensionArea.id,
    ]);
  });

  it('preserves source ordering when match tier and field priority are equal', () => {
    const results = rankAreaSearchResults(
      [octoberGardensArea, octoberArea],
      'اكتوبر',
      20,
    );

    expect(results.map((area) => area.id)).toEqual([
      octoberGardensArea.id,
      octoberArea.id,
    ]);
  });

  it('uses Arabic name, English name, then slug as field tie-breakers', () => {
    const englishNameMatch: TestArea = {
      id: 20,
      name_ar: 'اسم مختلف',
      name_en: 'October',
      slug: 'english-name-match',
    };
    const arabicNameMatch: TestArea = {
      id: 21,
      name_ar: 'October',
      name_en: null,
      slug: 'arabic-name-match',
    };
    const slugMatch: TestArea = {
      id: 22,
      name_ar: 'اسم آخر',
      name_en: null,
      slug: 'october',
    };

    const results = rankAreaSearchResults(
      [slugMatch, englishNameMatch, arabicNameMatch],
      'october',
      20,
    );

    expect(results.map((area) => area.id)).toEqual([21, 20, 22]);
  });

  it('matches English names and normalized slug tokens', () => {
    expect(rankAreaSearchResults(areas, 'sheikh', 20)[0]).toBe(
      sheikhZayedArea,
    );
    expect(
      rankAreaSearchResults(
        [northernExpansionsArea],
        'northern expansions',
        20,
      )[0],
    ).toBe(northernExpansionsArea);
  });

  it('supports one insertion, substitution, and transposition for long tokens', () => {
    expect(rankAreaSearchResults(areas, 'اكتبر', 20)[0]).toBe(octoberArea);
    expect(rankAreaSearchResults(areas, 'اكتوبز', 20)[0]).toBe(octoberArea);
    expect(rankAreaSearchResults(areas, 'اكتبور', 20)[0]).toBe(octoberArea);
  });

  it('does not apply typo tolerance to one- or two-character tokens', () => {
    const shortTokenAreas: TestArea[] = [
      { id: 10, name_ar: 'اج', name_en: null, slug: 'unrelated' },
    ];

    expect(rankAreaSearchResults(shortTokenAreas, 'اب', 20)).toEqual([]);
    expect(rankAreaSearchResults(shortTokenAreas, 'ب', 20)).toEqual([]);
  });

  it('returns no unrelated matches and respects the result limit', () => {
    expect(rankAreaSearchResults(areas, 'اسكندرية', 20)).toEqual([]);
    expect(rankAreaSearchResults(areas, 'اكتوبر', 1)).toEqual([octoberArea]);
  });

  it('keeps the existing leading results behavior for an empty search', () => {
    expect(rankAreaSearchResults(areas, '   ', 2)).toEqual(areas.slice(0, 2));
  });
});

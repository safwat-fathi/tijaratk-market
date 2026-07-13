const ARABIC_MARKS_AND_TATWEEL_REGEX =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const NON_ALPHANUMERIC_REGEX = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE_REGEX = /\s+/g;
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

type AreaSearchSource = {
  name_ar: string;
  name_en?: string | null;
  slug: string;
};

type NormalizedField = {
  value: string;
  fieldRank: number;
};

type MatchScore = {
  tier: number;
  fieldRank: number;
};

const normalizeDigit = (digit: string, digits: string) =>
  String(digits.indexOf(digit));

export function normalizeAreaSearchValue(value: string): string {
  return value
    .toLowerCase()
    .replace(ARABIC_MARKS_AND_TATWEEL_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/[٠-٩]/g, (digit) => normalizeDigit(digit, ARABIC_INDIC_DIGITS))
    .replace(/[۰-۹]/g, (digit) => normalizeDigit(digit, EASTERN_ARABIC_DIGITS))
    .replace(NON_ALPHANUMERIC_REGEX, ' ')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
}

const isSingleSubstitutionOrTransposition = (left: string, right: string) => {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const mismatchIndex = leftCharacters.findIndex(
    (character, index) => character !== rightCharacters[index],
  );
  if (mismatchIndex < 0) return true;

  const isSubstitution = leftCharacters
    .slice(mismatchIndex + 1)
    .every(
      (character, index) =>
        character === rightCharacters[mismatchIndex + 1 + index],
    );
  if (isSubstitution) return true;

  return (
    mismatchIndex + 1 < leftCharacters.length &&
    leftCharacters[mismatchIndex] === rightCharacters[mismatchIndex + 1] &&
    leftCharacters[mismatchIndex + 1] === rightCharacters[mismatchIndex] &&
    leftCharacters
      .slice(mismatchIndex + 2)
      .every(
        (character, index) =>
          character === rightCharacters[mismatchIndex + 2 + index],
      )
  );
};

const isSingleInsertion = (shorter: string, longer: string) => {
  const shorterCharacters = Array.from(shorter);
  const longerCharacters = Array.from(longer);
  const mismatchIndex = shorterCharacters.findIndex(
    (character, index) => character !== longerCharacters[index],
  );

  if (mismatchIndex < 0) return true;

  return shorterCharacters
    .slice(mismatchIndex)
    .every(
      (character, index) =>
        character === longerCharacters[mismatchIndex + 1 + index],
    );
};

const isWithinOneDamerauLevenshteinEdit = (left: string, right: string) => {
  const leftLength = Array.from(left).length;
  const rightLength = Array.from(right).length;
  if (Math.abs(leftLength - rightLength) > 1) return false;
  if (left === right) return true;

  if (leftLength === rightLength) {
    return isSingleSubstitutionOrTransposition(left, right);
  }

  return leftLength < rightLength
    ? isSingleInsertion(left, right)
    : isSingleInsertion(right, left);
};

const tokenMatchesWithoutTypo = (queryToken: string, candidateToken: string) =>
  candidateToken === queryToken || candidateToken.startsWith(queryToken);

const tokenMatchesWithTypo = (queryToken: string, candidateToken: string) =>
  tokenMatchesWithoutTypo(queryToken, candidateToken) ||
  (Array.from(queryToken).length >= 3 &&
    isWithinOneDamerauLevenshteinEdit(queryToken, candidateToken));

const hasTokenCoverage = (
  queryTokens: string[],
  candidateTokens: string[],
  allowTypo: boolean,
) =>
  queryTokens.every((queryToken) =>
    candidateTokens.some((candidateToken) =>
      allowTypo
        ? tokenMatchesWithTypo(queryToken, candidateToken)
        : tokenMatchesWithoutTypo(queryToken, candidateToken),
    ),
  );

const getFieldMatchTier = (field: string, query: string): number | null => {
  if (field === query) return 0;
  if (field.startsWith(query) || field.includes(query)) return 1;

  const queryTokens = query.split(' ');
  const fieldTokens = field.split(' ');
  if (hasTokenCoverage(queryTokens, fieldTokens, false)) return 2;

  if (
    (queryTokens.length === 1 &&
      Array.from(query).length >= 3 &&
      isWithinOneDamerauLevenshteinEdit(query, field)) ||
    hasTokenCoverage(queryTokens, fieldTokens, true)
  ) {
    return 3;
  }

  return null;
};

const getBestMatchScore = (
  fields: NormalizedField[],
  query: string,
): MatchScore | null => {
  let bestScore: MatchScore | null = null;

  for (const field of fields) {
    const tier = getFieldMatchTier(field.value, query);
    if (tier === null) continue;

    if (
      !bestScore ||
      tier < bestScore.tier ||
      (tier === bestScore.tier && field.fieldRank < bestScore.fieldRank)
    ) {
      bestScore = { tier, fieldRank: field.fieldRank };
    }
  }

  return bestScore;
};

export function rankAreaSearchResults<T extends AreaSearchSource>(
  areas: T[],
  search: string,
  limit: number,
): T[] {
  const normalizedQuery = normalizeAreaSearchValue(search);
  if (!normalizedQuery) return areas.slice(0, limit);

  return areas
    .map((area, originalIndex) => {
      const fields = [
        { value: normalizeAreaSearchValue(area.name_ar), fieldRank: 0 },
        ...(area.name_en
          ? [{ value: normalizeAreaSearchValue(area.name_en), fieldRank: 1 }]
          : []),
        { value: normalizeAreaSearchValue(area.slug), fieldRank: 2 },
      ].filter((field) => field.value.length > 0);

      return {
        area,
        originalIndex,
        score: getBestMatchScore(fields, normalizedQuery),
      };
    })
    .filter(
      (
        result,
      ): result is typeof result & {
        score: MatchScore;
      } => result.score !== null,
    )
    .sort(
      (left, right) =>
        left.score.tier - right.score.tier ||
        left.score.fieldRank - right.score.fieldRank ||
        left.originalIndex - right.originalIndex,
    )
    .slice(0, limit)
    .map((result) => result.area);
}

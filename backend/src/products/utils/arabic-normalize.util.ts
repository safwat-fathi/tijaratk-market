const ALEF_VARIANTS_REGEX = /[أإآٱ]/g;
const TASHKEEL_TATWEEL_REGEX =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0640]/g;
const PARENTHETICAL_REGEX = /\([^)]*\)/g;
const PACKAGE_SIZE_REGEX =
  /\d+\s*(?:جم|جرام|كجم|كيلو|ك|g|kg)|(?:جم|جرام|كجم|كيلو|ك|g|kg)\s*\d+/gi;
const NON_WORD_REGEX = /[^\p{L}\p{N}\s]/gu;
const LEADING_ARTICLE_REGEX = /(^|\s)ال(?=\p{L})/gu;
const WHITESPACE_REGEX = /\s+/g;

export function arabicNormalize(input: string): string {
  return input
    .toLowerCase()
    .replace(TASHKEEL_TATWEEL_REGEX, '')
    .replace(ALEF_VARIANTS_REGEX, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(PARENTHETICAL_REGEX, ' ')
    .replace(PACKAGE_SIZE_REGEX, ' ')
    .replace(NON_WORD_REGEX, ' ')
    .replace(LEADING_ARTICLE_REGEX, '$1')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
}

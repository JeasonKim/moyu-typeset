export interface HeadingSequenceOmission {
  label: string;
  omittedPrefix: string;
  omittedCharacterCount: number;
}

const chineseNumeral = '[〇零一二三四五六七八九十百千两]+';
const romanNumeral = '(?:[IVXLCDM]+|[ivxlcdm]+)';
const arabicNumeral = '\\d{1,3}';
const ordinalLabel = `(?:${arabicNumeral}|${chineseNumeral}|${romanNumeral})`;
const measurementAfterDecimal =
  '(?!倍|%|％|个百分点|元|岁|年|月|日|万|亿|米|厘米|毫米|千米|公斤|克|kg\\b|g\\b|km\\b|cm\\b|mm\\b)';

const headingSequencePatterns = [
  new RegExp(`^\\s*第\\s*(?:${arabicNumeral}|${chineseNumeral})\\s*[章节篇部分]\\s*(?:[、.．:：])?\\s*`),
  new RegExp(`^\\s*[（(【\\[]\\s*${ordinalLabel}\\s*[）)】\\]]\\s*(?:[、.．:：])?\\s*`),
  new RegExp(`^\\s*${ordinalLabel}\\s*[）)]\\s*`),
  new RegExp(
    `^\\s*${arabicNumeral}(?:[.．]${arabicNumeral})+(?:[、.．:：]\\s*|\\s+)${measurementAfterDecimal}`,
    'i',
  ),
  new RegExp(`^\\s*(?:${chineseNumeral}|${romanNumeral})\\s*[、.．:：]\\s*`),
  new RegExp(`^\\s*${arabicNumeral}\\s*[、:：]\\s*`),
  new RegExp(`^\\s*${arabicNumeral}\\s*[.．](?!\\d)\\s*`),
];

export function omitRedundantHeadingSequence(label: string): HeadingSequenceOmission {
  for (const pattern of headingSequencePatterns) {
    const match = label.match(pattern);
    if (!match) continue;

    const remainingLabel = label.slice(match[0].length);
    if (!remainingLabel.trim()) continue;

    return {
      label: remainingLabel,
      omittedPrefix: match[0],
      omittedCharacterCount: match[0].length,
    };
  }

  return {
    label,
    omittedPrefix: '',
    omittedCharacterCount: 0,
  };
}

const EMOTICON_PATTERN = /\p{Extended_Pictographic}/u;

/** True bila `value` mengandung emoticon/emoji. */
export function hasEmoticon(value: string): boolean {
  return EMOTICON_PATTERN.test(value);
}

export const WITHOUT_EMOTICON_MESSAGE = 'Emoticon is not allowed.';

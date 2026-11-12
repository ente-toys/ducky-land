export const CHAT_LIMIT = 120;
export const CHAT_INTERVAL = 200;
export const CHAT_DURATION = 5000;

export function chatText(value) {
  if (typeof value !== 'string' || value.length > CHAT_LIMIT) return null;
  return value.replace(/[\s\p{Cc}]+/gu, ' ').trim();
}

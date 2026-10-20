/** Key pesan saat kredensial kosong (dipakai `useLoginForm`). */
export const LOGIN_EMPTY_CREDENTIALS_KEY = 'auth.usernameRequired';

/**
 * Validasi input login sebelum submit.
 * @returns i18n key pesan error, atau `null` bila valid.
 */
export function validateLoginInput(username: string, password: string): string | null {
  if (!username.trim() || !password) return LOGIN_EMPTY_CREDENTIALS_KEY;
  return null;
}

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidPassword(value: string): boolean {
  return PASSWORD_PATTERN.test(value);
}

export const DEFAULT_PASSWORD = 'Demo123!';

export function passwordChangeError(newPassword: string, confirmPassword: string) {
  if (newPassword.length < 8 || newPassword.length > 72) return 'New password must be between 8 and 72 characters';
  if (newPassword !== confirmPassword) return 'Passwords do not match';
  if (newPassword === DEFAULT_PASSWORD) return 'Choose a password different from the default password';
  return '';
}

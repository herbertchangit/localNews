import { describe, expect, it } from 'vitest';
import { passwordChangeError } from '../server/passwordPolicy';

describe('required default-password change', () => {
  it('accepts a confirmed non-default password', () => expect(passwordChangeError('Secure456!', 'Secure456!')).toBe(''));
  it('rejects a mismatched confirmation', () => expect(passwordChangeError('Secure456!', 'Secure457!')).toBe('Passwords do not match'));
  it('rejects the default password', () => expect(passwordChangeError('Demo123!', 'Demo123!')).toContain('default'));
  it('rejects a short password', () => expect(passwordChangeError('short', 'short')).toContain('8 and 72'));
});

import{describe,expect,it}from'vitest';
import{isContactMatch,loginEmailForContact,normalizeLoginContact}from'../server/loginIdentifier';

describe('login contact matching',()=>{
  it('ignores contact punctuation',()=>expect(isContactMatch('0126399362','012-639 9362')).toBe(true));
  it('matches Malaysian local and international formats',()=>expect(isContactMatch('+60 12-639 9362','012-639 9362')).toBe(true));
  it('rejects short and different contacts',()=>{expect(isContactMatch('123','123')).toBe(false);expect(isContactMatch('0126399362','0126399363')).toBe(false)});
  it('normalizes an international Malaysian contact',()=>expect(normalizeLoginContact('(+60) 12 639-9362')).toBe('0126399362'));
  it('creates a stable internal email for contact-only imports',()=>expect(loginEmailForContact('019-668 3329')).toBe('contact-0196683329@local.invalid'));
});

import{describe,expect,it}from'vitest';
import{whatsappEventInvitationUrl,whatsappInviteUrl,whatsappPhone}from'./whatsappInvite';

describe('WhatsApp invitations',()=>{
  it('converts a Malaysian local number to international format',()=>expect(whatsappPhone('012-639 9362')).toBe('60126399362'));
  it('keeps an existing international number',()=>expect(whatsappPhone('+60 12-639 9362')).toBe('60126399362'));
  it('builds an encoded sign-in invitation',()=>{const url=whatsappInviteUrl({phone:'012-639 9362',recipientName:'Carina Lew',inviterName:'Chai Fong',origin:'https://local.news'});expect(url).toContain('https://wa.me/60126399362?text=');expect(decodeURIComponent(url)).toContain('Carina Lew');expect(decodeURIComponent(url)).toContain('Chai Fong');expect(decodeURIComponent(url)).toContain('https://local.news/login')});
  it('builds a direct event invitation for the user contact',()=>{const url=whatsappEventInvitationUrl({phone:'012-639 9362',recipientName:'Carina Lew',inviterName:'Chai Fong',eventName:'Community Gathering',shareUrl:'https://local.news/registration/community?invite=abc'});expect(url).toContain('https://wa.me/60126399362?text=');expect(decodeURIComponent(url)).toContain('Community Gathering');expect(decodeURIComponent(url)).toContain('https://local.news/registration/community?invite=abc')});
});

import{describe,expect,it}from'vitest';
import{authorityForRole,sidebarAuthority}from'./sidebarAuthority';

describe('sidebar authorization matrix',()=>{
  it('allows every main sidebar item for Admin',()=>{
    expect(sidebarAuthority.ADMIN).toEqual({overview:'allow',stories:'allow',people:'allow',analytics:'allow',settings:'allow'});
  });
  it.each(['VOLUNTEER','DADE']as const)('%s sees Stories and own-profile Settings only',role=>{
    expect(authorityForRole(role)).toEqual({overview:false,stories:'allow',people:false,analytics:false,settings:'own-profile'});
  });
});

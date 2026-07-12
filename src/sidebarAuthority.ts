export type SidebarItem="overview"|"stories"|"people"|"analytics"|"settings";
export type SidebarAccess=false|"allow"|"own-profile";
export type SidebarRole="ADMIN"|"VOLUNTEER"|"DADE"|"AUDIENCE"|"EDITOR"|"REPORTER";

export const sidebarAuthority:Record<"ADMIN"|"VOLUNTEER"|"DADE",Record<SidebarItem,SidebarAccess>>={
  ADMIN:{overview:"allow",stories:"allow",people:"allow",analytics:"allow",settings:"allow"},
  VOLUNTEER:{overview:false,stories:"allow",people:false,analytics:false,settings:"own-profile"},
  DADE:{overview:false,stories:"allow",people:false,analytics:false,settings:"own-profile"},
};

export function authorityForRole(role:SidebarRole){
  if(role==="ADMIN")return sidebarAuthority.ADMIN;
  if(role==="DADE"||role==="AUDIENCE")return sidebarAuthority.DADE;
  return sidebarAuthority.VOLUNTEER;
}

export const hasAdminSidebar=(role:SidebarRole)=>authorityForRole(role).overview==="allow";
export const hasOwnProfileSettings=(role:SidebarRole)=>authorityForRole(role).settings==="own-profile";

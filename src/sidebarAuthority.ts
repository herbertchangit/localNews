export type SidebarItem="overview"|"stories"|"people"|"analytics"|"settings";
export type SidebarAccess=false|"allow"|"own-profile";
export type SidebarRole="ADMIN"|"VOLUNTEER"|"DADE"|"AUDIENCE"|"EDITOR"|"REPORTER";

export const sidebarAuthority:Record<"ADMIN"|"EDITOR"|"VOLUNTEER"|"DADE",Record<SidebarItem,SidebarAccess>>={
  ADMIN:{overview:"allow",stories:"allow",people:"allow",analytics:"allow",settings:"allow"},
  EDITOR:{overview:"allow",stories:"allow",people:false,analytics:false,settings:"own-profile"},
  VOLUNTEER:{overview:false,stories:"allow",people:false,analytics:false,settings:"own-profile"},
  DADE:{overview:false,stories:"allow",people:false,analytics:false,settings:"own-profile"},
};

export function authorityForRole(role:SidebarRole){
  if(role==="ADMIN")return sidebarAuthority.ADMIN;
  if(role==="EDITOR")return sidebarAuthority.EDITOR;
  if(role==="DADE"||role==="AUDIENCE")return sidebarAuthority.DADE;
  return sidebarAuthority.VOLUNTEER;
}

export const hasAdminSidebar=(role:SidebarRole)=>role==="ADMIN";
export const hasEditorialDashboard=(role:SidebarRole)=>role==="ADMIN"||role==="EDITOR";
export const hasOwnProfileSettings=(role:SidebarRole)=>authorityForRole(role).settings==="own-profile";

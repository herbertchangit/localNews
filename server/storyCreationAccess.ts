type StoryRoleProfile = {
  menuIds: string[];
  authorities: unknown;
};

export const roleProfilesAllowStoryCreation = (
  profiles: StoryRoleProfile[],
) =>
  profiles.some((profile) => {
    if (!profile.menuIds.includes("stories")) return false;
    const configured = (profile.authorities || {}) as Record<string, string[]>;
    return (
      !Object.keys(configured).length || configured.stories?.includes("new")
    );
  });

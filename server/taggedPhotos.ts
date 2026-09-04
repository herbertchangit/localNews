// Tag ownership and private-story visibility apply independently of publication.
export function taggedPhotoWhere(userId: string, canViewPrivate: boolean) {
  return {
    userTags: { some: { userId } },
    article: canViewPrivate ? {} : { isPublic: true },
  };
}

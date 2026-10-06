// Tag ownership and story audience rules apply independently of publication.
export function taggedPhotoWhere(
  userId: string,
  articleVisibility: Record<string, unknown>,
) {
  return {
    userTags: { some: { userId } },
    article: articleVisibility,
  };
}

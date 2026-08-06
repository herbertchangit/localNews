export const ARTICLE_PUBLICATION_WINDOW_DAYS = 7;

export const ARTICLE_PUBLICATION_WINDOW_MS =
  ARTICLE_PUBLICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const articlePublicationCutoff = (now = new Date()) =>
  new Date(now.getTime() - ARTICLE_PUBLICATION_WINDOW_MS);

export const isArticlePublicationExpired = (
  publishedAt: Date | string | null | undefined,
  now = new Date(),
) => Boolean(publishedAt && new Date(publishedAt).getTime() < articlePublicationCutoff(now).getTime());

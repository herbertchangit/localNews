export const USER_PAGE_SIZE = 6;

export function pageCount(total: number, pageSize = USER_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginate<T>(items: T[], page: number, pageSize = USER_PAGE_SIZE) {
  const safePage = Math.min(Math.max(1, page), pageCount(items.length, pageSize));
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}

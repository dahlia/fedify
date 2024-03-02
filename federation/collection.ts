/**
 * A page of items.
 */
export interface PageItems<TItem> {
  prevCursor?: string | null;
  nextCursor?: string | null;
  items: TItem[];
}

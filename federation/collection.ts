/**
 * A page of items.
 */
export interface Page<TItem> {
  prevCursor?: string | null;
  nextCursor?: string | null;
  items: TItem[];
}

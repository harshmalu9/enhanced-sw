export const CANONICAL_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Groceries",
  "Personal Care",
  "Other",
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

export const CANONICAL_CATEGORIES_SET = new Set<string>(CANONICAL_CATEGORIES);

/**
 * Validates and normalizes category name against canonical set.
 * Returns exact canonical name if matched (case-insensitive), or null if invalid.
 */
export function normalizeCategory(category: string): CanonicalCategory | null {
  if (!category || typeof category !== "string") return null;
  const clean = category.trim().toLowerCase();
  for (const canonical of CANONICAL_CATEGORIES) {
    if (clean === canonical.toLowerCase()) {
      return canonical;
    }
  }
  return null;
}

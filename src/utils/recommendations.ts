import { BedsheetProduct } from '../data/products';

/**
 * Calculates a relevance similarity score between two bedsheet products
 * using deterministic catalog metadata (collection, pattern, dimensions, color tone, fabric).
 */
export function scoreProductSimilarity(target: BedsheetProduct, candidate: BedsheetProduct): number {
  if (target.id === candidate.id) return -1; // Never recommend self

  let score = 0;

  // 1. Same Collection (Strongest affinity)
  if (target.collection && candidate.collection) {
    if (target.collection.toLowerCase() === candidate.collection.toLowerCase()) {
      score += 4.0;
    }
  }

  // 2. Pattern Match
  if (target.pattern && candidate.pattern) {
    const tPattern = target.pattern.toLowerCase();
    const cPattern = candidate.pattern.toLowerCase();
    if (tPattern === cPattern) {
      score += 3.0;
    } else if (tPattern.includes(cPattern) || cPattern.includes(tPattern)) {
      score += 1.5;
    }
  }

  // 3. Dimensions / Size Match (e.g. King 108x108)
  if (target.dimensions && candidate.dimensions) {
    if (target.dimensions.toLowerCase() === candidate.dimensions.toLowerCase()) {
      score += 2.0;
    }
  }

  // 4. Color Tone or Variant affinity
  if (target.colorTone && candidate.colorTone) {
    if (target.colorTone.toLowerCase() === candidate.colorTone.toLowerCase()) {
      score += 1.5;
    }
  }

  // 5. In-stock boost (buyers prefer available products)
  if (candidate.inStock && (candidate.stockQuantity === undefined || candidate.stockQuantity > 0)) {
    score += 1.0;
  }

  // 6. Price proximity (within 20% range)
  if (target.price > 0 && candidate.price > 0) {
    const diffRatio = Math.abs(target.price - candidate.price) / target.price;
    if (diffRatio <= 0.2) {
      score += 1.0;
    }
  }

  return score;
}

/**
 * Returns top N recommended bedsheet products based on catalogue similarity
 */
export function getRecommendedProducts(
  currentProduct: BedsheetProduct,
  catalog: BedsheetProduct[],
  limit: number = 4
): BedsheetProduct[] {
  if (!catalog || catalog.length === 0) return [];

  const scored = catalog
    .filter((p) => p.id !== currentProduct.id)
    .map((p) => ({
      product: p,
      score: scoreProductSimilarity(currentProduct, p),
    }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.product);
}

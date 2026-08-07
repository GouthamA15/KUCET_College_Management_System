export function normalizeRange(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return ((value - min) / (max - min)) * 100;
}

export function normalizePercentage(pct) {
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

export function normalizeInverse(pct) {
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return 100 - pct;
}

export function computeWeightedSum(components, weights) {
  let sum = 0;
  let totalWeight = 0;
  
  for (const [key, value] of Object.entries(components)) {
    const weight = weights[key] || 0;
    sum += value.normalizedScore * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return 0;
  return sum / totalWeight;
}

export function toGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 59) return 'C';
  if (score >= 44) return 'D';
  return 'F';
}

export function toRiskLevel(riskScore) {
  if (riskScore >= 75) return 'CRITICAL';
  if (riskScore >= 50) return 'HIGH';
  if (riskScore >= 25) return 'MEDIUM';
  return 'LOW';
}

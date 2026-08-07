export function calcPercentage(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function calcGrade(percentage) {
  if (percentage >= 90) return 'O';
  if (percentage >= 80) return 'A+';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B+';
  if (percentage >= 50) return 'B';
  if (percentage >= 40) return 'C';
  return 'F';
}

export function calcTrend(values) {
  if (!values || values.length < 2) return 'STABLE';
  let up = 0;
  let down = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) up++;
    else if (values[i] < values[i - 1]) down++;
  }
  if (up > down && up > 0) return 'IMPROVING';
  if (down > up && down > 0) return 'DECLINING';
  return 'STABLE';
}

export function groupByWeek(records, dateField) {
  const grouped = {};
  records.forEach(record => {
    const d = new Date(record[dateField]);
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((dCopy - yearStart) / 86400000) + 1)/7);
    const year = dCopy.getUTCFullYear();
    const key = `${year}-W${weekNo.toString().padStart(2, '0')}`;
    
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(record);
  });
  return grouped;
}

export function calcMovingAverage(values, windowSize) {
  if (!values || values.length === 0 || windowSize <= 0) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += values[i - j];
      }
      result.push(Number((sum / windowSize).toFixed(2)));
    }
  }
  return result;
}

export function calcStdDev(values) {
  if (!values || values.length === 0) return 0;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return Number(Math.sqrt(variance).toFixed(2));
}

export function calcPercentile(values, percentile) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  if (lower === upper) return sorted[lower];
  return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
}

/**
 * Calculates the distance between two points on Earth using the Haversine formula.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters
 */
export function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const deltaP = ((lat2 - lat1) * Math.PI) / 180;
  const deltaL = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaP / 2) * Math.sin(deltaP / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(deltaL / 2) * Math.sin(deltaL / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validates if a student is within the allowed radius of the faculty.
 * @param {number} facLat Faculty Latitude
 * @param {number} facLon Faculty Longitude
 * @param {number} studLat Student Latitude
 * @param {number} studLon Student Longitude
 * @param {number} radius Allowed radius in meters (default 50m)
 * @returns {boolean}
 */
export function isWithinRange(facLat, facLon, studLat, studLon, radius = 50) {
  const distance = getHaversineDistance(facLat, facLon, studLat, studLon);
  const ok = distance <= radius;
  if (!ok) {
    console.info(`[Geo] Out of range: ${distance.toFixed(2)}m (Max: ${radius}m). Faculty: ${facLat},${facLon}. Student: ${studLat},${studLon}`);
  }
  return ok;
}

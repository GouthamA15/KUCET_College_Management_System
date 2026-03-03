import { query } from './db';

/**
 * Basic Rate Limiter using MySQL
 * @param {string} key - Unique key for the limit (e.g., 'upload:123' or 'ip:1.2.3.4')
 * @param {number} limit - Max allowed points
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{success: boolean, remaining: number}>}
 */
export async function checkRateLimit(key, limit, windowSeconds) {
  try {
    const now = new Date();
    
    // 1. Clean up expired limits occasionally (handled by DB cleanup job normally, but let's do it here for now)
    // await query('DELETE FROM rate_limits WHERE expire_at < NOW()');

    // 2. Fetch current points
    const [row] = await query(
      'SELECT points, expire_at FROM rate_limits WHERE key_name = ?',
      [key]
    );

    if (!row) {
      // First time: Create new record
      const expireAt = new Date(now.getTime() + windowSeconds * 1000);
      await query(
        'INSERT INTO rate_limits (key_name, points, expire_at) VALUES (?, 1, ?)',
        [key, expireAt]
      );
      return { success: true, remaining: limit - 1 };
    }

    // Check if expired
    const expireAt = new Date(row.expire_at);
    if (expireAt < now) {
      // Expired: Reset
      const newExpireAt = new Date(now.getTime() + windowSeconds * 1000);
      await query(
        'UPDATE rate_limits SET points = 1, expire_at = ? WHERE key_name = ?',
        [newExpireAt, key]
      );
      return { success: true, remaining: limit - 1 };
    }

    // Not expired: Check points
    if (row.points >= limit) {
      return { success: false, remaining: 0 };
    }

    // Increment points
    await query(
      'UPDATE rate_limits SET points = points + 1 WHERE key_name = ?',
      [key]
    );

    return { success: true, remaining: limit - (row.points + 1) };

  } catch (error) {
    console.error('Rate Limit Error:', error);
    return { success: true, remaining: 1 }; // Fail open to not block users on DB error
  }
}

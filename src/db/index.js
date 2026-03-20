import { drizzle } from 'drizzle-orm/mysql2';
import { getDb } from '../lib/db.js';
import * as schema from './schema.js';

const pool = getDb();
export const db = drizzle(pool, { schema, mode: 'default' });

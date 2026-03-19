import { drizzle } from 'drizzle-orm/mysql2';
import { getDb } from '@/lib/db';
import * as schema from './schema';

const pool = getDb();
export const db = drizzle(pool, { schema, mode: 'default' });

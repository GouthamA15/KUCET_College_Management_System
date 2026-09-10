import { drizzle } from 'drizzle-orm/mysql2';
import { getExperimentDb } from './connection';
import * as eventSchema from './schema';

const pool = getExperimentDb();
export const eventDb = drizzle(pool, { schema: eventSchema, mode: 'default' });

export * from './schema';
export { getExperimentDb, queryExperimentDb } from './connection';
export { initExperimentDb } from './init';

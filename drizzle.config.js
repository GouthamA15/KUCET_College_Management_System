import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load from .env or .env.local (Next.js default)
config({ path: '.env.local' });
config(); // Fallback to standard .env

export default defineConfig({
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  },
});

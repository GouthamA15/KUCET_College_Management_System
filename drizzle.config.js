import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load from standard .env first
config();
// Override with .env.local if it exists
config({ path: '.env.local', override: true });

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

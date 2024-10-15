import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.MYSQL_CONNECTION) {
  throw new Error('MYSQL_CONNECTION environment variable is not set.');
}

const knexfile: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: process.env.MYSQL_CONNECTION,
    pool: {
      min: 2, // Minimum number of connections
      max: 10, // Adjust for development environment to avoid overloading MySQL
      acquireTimeoutMillis: 30000, // Wait for a connection before throwing an error
      createTimeoutMillis: 30000, // Time to create a new connection
      idleTimeoutMillis: 30000, // Time to close idle connections
      reapIntervalMillis: 1000, // Frequency to check for idle connections
      log: process.env.NODE_ENV === 'development'
        ? (message) => console.log('Pool log:', message)
        : undefined, // Conditional logging
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, './src/migrations'), // Ensure correct path
    },
  },
};

export default knexfile;

import { Knex } from 'knex';
import { KnexStorageMigrations } from '@bsv/overlay';

export async function up(knex: Knex): Promise<void> {
  const migrations = KnexStorageMigrations.default;

  for (const migration of migrations) {
    try {
      console.log(`Running migration: ${migration.constructor.name || 'Unknown'}`);
      // Example of table existence check
      const tableExists = await knex.schema.hasTable('outputs');
      if (!tableExists) {
        await migration.up(knex);
      } else {
        console.log(`Skipping migration ${migration.constructor.name}, table already exists.`);
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.log(`Error running migration: ${err.message || 'Unknown error'}`);
      if (err.code !== 'ER_TABLE_EXISTS_ERROR') throw err;
    }
  }
}


export async function down(knex: Knex): Promise<void> {
  const migrations = KnexStorageMigrations.default;

  for (let i = migrations.length - 1; i >= 0; i--) {
    try {
      const tableExists = await knex.schema.hasTable('applied_transactions');
      if (tableExists) {
        console.log(`Reverting migration: ${migrations[i].constructor.name || 'Unknown'}`);
        await migrations[i].down(knex);
      } else {
        console.log(`Skipping revert: 'applied_transactions' table does not exist.`);
      }
    } catch (error) {
      const err = error as { message?: string };
      console.log(`Error reverting migration: ${err.message || 'Unknown error'}`);
    }
  }
}


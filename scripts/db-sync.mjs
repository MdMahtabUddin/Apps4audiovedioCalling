import { execSync } from 'child_process';

const dbUrl =
  process.env.POSTGRES_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.DATABASE_URL;

console.log('🔄 Checking database connection and schema sync...');

if (dbUrl && !dbUrl.includes('localhost:5432')) {
  try {
    console.log('🔄 Running prisma db push to sync all PostgreSQL tables...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'inherit',
    });
    console.log('✅ Remote PostgreSQL tables synced successfully!');
  } catch (error) {
    console.error('⚠️ Prisma db push note:', error.message);
  }
} else {
  console.log('ℹ️ Skipping remote DB push for local dev build');
}

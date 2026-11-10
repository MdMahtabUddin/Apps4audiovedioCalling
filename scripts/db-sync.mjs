import { execSync } from 'child_process';

const dbUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.DATABASE_URL;

if (dbUrl && !dbUrl.includes('localhost:5432')) {
  try {
    console.log('🔄 Syncing Prisma schema with remote PostgreSQL database...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'inherit',
    });
    console.log('✅ Remote PostgreSQL database schema synced successfully');
  } catch (error) {
    console.warn('⚠️ Prisma db push note (continuing build):', error.message);
  }
} else {
  console.log('ℹ️ Skipping remote DB push during local development build');
}

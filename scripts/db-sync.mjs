import { execSync } from 'child_process';

const hasDb = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

if (hasDb && !process.env.DATABASE_URL?.includes('localhost:5432')) {
  try {
    console.log('🔄 Syncing Prisma schema with remote database...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    console.log('✅ Remote database schema synced successfully');
  } catch (error) {
    console.warn('⚠️ Prisma db push note (continuing build):', error.message);
  }
} else {
  console.log('ℹ️ Skipping remote DB push during local development build');
}

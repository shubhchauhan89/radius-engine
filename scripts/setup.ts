import { execSync } from 'child_process';

console.log('Running setup script...');

try {
  // Generate Prisma client
  console.log('Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('Setup completed successfully.');
} catch (error) {
  console.error('Error during setup:', error);
  process.exit(1);
}

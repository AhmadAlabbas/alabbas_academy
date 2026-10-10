import {cp, access, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(path.join(projectDir, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('The platform environment file could not be loaded.');
}
const outputDir = path.join(projectDir, '.next/standalone');
const serverFile = path.join(outputDir, 'server.js');
try {
  await access(serverFile);
} catch {
  console.error('Build the platform with npm run build before starting it.');
  process.exit(1);
}

// Next intentionally omits public/static files from standalone tracing. Copy
// only generated output, never application data or private environment files.
for (const [source, destination] of [['public', 'public'], ['.next/static', '.next/static']]) {
  const target = path.join(outputDir, destination);
  await rm(target, {recursive: true, force: true});
  await mkdir(path.dirname(target), {recursive: true});
  await cp(path.join(projectDir, source), target, {recursive: true});
}

process.env.PORT ||= '3001';
process.env.HOSTNAME = process.env.ACADEMY_HOST || '127.0.0.1';
await import(pathToFileURL(serverFile).href);

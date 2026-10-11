import {hash, verify} from '@node-rs/argon2';

const parameters = {memoryCost:65536, timeCost:3, parallelism:1, outputLen:32};
const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$jj2MhXpqfxp6n9KTg6f1xQ$PGLBBUZcSWPQYt2UI0WyMnMKB1pHzDcwPEMw6FOQjhU';

export function hashPassword(password: string): Promise<string> {
  return hash(password, parameters);
}

export async function verifyPassword(password: string, storedHash?: string|null): Promise<boolean> {
  try {
    const matches = await verify(storedHash ?? dummyHash, password);
    return Boolean(storedHash && matches);
  } catch {
    return false;
  }
}

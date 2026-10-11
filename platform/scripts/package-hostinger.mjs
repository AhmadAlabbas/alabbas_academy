import { cp, mkdir, rm, access, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve("."),
  target = resolve(".local/hostinger-package");
await access(join(root, ".next/standalone/server.js"));
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(join(root, ".next/standalone"), target, {
  recursive: true,
  filter: (source) => !/(^|\/)(\.env[^/]*|\.local|\.git)(\/|$)/.test(source),
});
await cp(join(root, "public"), join(target, "public"), { recursive: true });
await cp(join(root, ".next/static"), join(target, ".next/static"), {
  recursive: true,
});
await cp(join(root, "prisma"), join(target, "prisma"), { recursive: true });
await cp(join(root, ".env.example"), join(target, ".env.example"));
await cp(join(root, "README.md"), join(target, "DEPLOYMENT.md"));
// Generated standalone package has runtime dependencies, not build tooling.
await writeFile(
  join(target, "UPLOAD-NOTES.txt"),
  "Run migrations and seed from the source checkout before starting this runtime package. Set private environment variables in Hostinger. Start: node server.js. Keep uploads outside this directory. This Linux build must run on a compatible Linux Node 22+ host. Prefer GitHub source deployment for portability.\n",
);
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (/^\.env(?!\.example$)/.test(entry.name))
      throw Error("Private environment file found");
    if (entry.isDirectory() && !entry.isSymbolicLink())
      await check(join(directory, entry.name));
  }
}
await check(target);
console.log(
  "Runtime package prepared at .local/hostinger-package. No private environment files or uploads included.",
);

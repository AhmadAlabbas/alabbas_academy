// Hostinger root entry point delegates to the full Next.js platform.
import('./platform/server.js').catch(() => {
  console.error('Unable to start Alabbas Academy. Run npm run build and check the private hosting configuration.');
  process.exitCode = 1;
});

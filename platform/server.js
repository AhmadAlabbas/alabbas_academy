// LiteSpeed's Hostinger loader calls require(server.js). Keep this entry's
// synchronous module graph free of top-level await; load the async startup
// helper using import() so both require() and direct node startup work.
import("./scripts/start-standalone.mjs").catch((error) => {
  console.error(
    "Alabbas Academy could not start. Check the build output and private hosting configuration.",
    error.code || error.name || "STARTUP_ERROR",
  );
  process.exitCode = 1;
});

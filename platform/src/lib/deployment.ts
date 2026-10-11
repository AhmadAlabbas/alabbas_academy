/** Set at both build time and runtime on the separate staging application. */
export function isStaging() {
  return process.env.ACADEMY_ENVIRONMENT === 'staging';
}

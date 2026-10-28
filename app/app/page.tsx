// Some deployments and old Mini App links still resolve the homepage through
// /app. Render the homepage here instead of redirecting back to /, which can
// create a redirect loop when the host rewrites / to /app.
export { default } from "../page";

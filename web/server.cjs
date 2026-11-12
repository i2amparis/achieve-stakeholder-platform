// Entry file for Hostinger's Node.js web apps. Their LiteSpeed runner loads the entry with
// require(), but the SvelteKit build (build/index.js) is an ES module with top-level await,
// which require() rejects (ERR_REQUIRE_ASYNC_MODULE). import() works from CommonJS.
import('./build/index.js').catch((error) => {
	console.error(error);
	process.exit(1);
});

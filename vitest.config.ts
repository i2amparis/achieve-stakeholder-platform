import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// The integration suites share the local Directus database: run files one at a time.
		fileParallelism: false,
		// the SvelteKit app has its own Vitest setup (cd web && npm test)
		exclude: ['**/node_modules/**', 'web/**', 'drupal/vendor/**', 'drupal/web/**']
	}
});

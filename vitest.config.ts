import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// The integration suites share the local Directus database: run files one at a time.
		fileParallelism: false
	}
});

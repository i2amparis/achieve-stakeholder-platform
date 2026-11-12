// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Error {
			status: number;
			message: string;
		}
	}
}

export {};

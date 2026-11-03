import { loadStaticPage } from '#lib/server/static-page.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => loadStaticPage('about', (await parent()).locale);

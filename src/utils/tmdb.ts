import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

// TMDB API key — can be overridden via the TMDB_API_KEY environment variable.
// Using a public read-only key as a fallback so the library works out of the box.
const TMDB_API_KEY =
  (typeof process !== 'undefined' && process.env?.TMDB_API_KEY) || 'a500049f3e06109fe3e8289b06cf5685';

export async function fetchTMDBName(
  ctx: ShowScrapeContext | MovieScrapeContext,
  lang: string = 'en-US',
): Promise<string> {
  const type = ctx.media.type === 'movie' ? 'movie' : 'tv';
  const url = `https://api.themoviedb.org/3/${type}/${ctx.media.tmdbId}?api_key=${TMDB_API_KEY}&language=${lang}`;

  const data = await ctx.fetcher<{ title?: string; name?: string }>(url);
  const title = ctx.media.type === 'movie' ? data.title : data.name;
  if (!title) throw new Error(`Error fetching TMDB data: no title returned for ${ctx.media.tmdbId}`);
  return title;
}

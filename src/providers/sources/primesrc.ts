import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  const baseApiUrl = 'https://primesrc.me/api/v1/';

  let serverData;
  try {
    if (ctx.media.type === 'movie') {
      const url = `${baseApiUrl}s?tmdb=${ctx.media.tmdbId}&type=movie`;
      serverData = await ctx.proxiedFetcher.full<any>(url);
    } else {
      const url = `${baseApiUrl}s?tmdb=${ctx.media.tmdbId}&season=${ctx.media.season.number}&episode=${ctx.media.episode.number}&type=tv`;
      serverData = await ctx.proxiedFetcher.full<any>(url);
    }
  } catch (error) {
    return { embeds: [] };
  }

  let data;
  try {
    data = typeof serverData.body === 'string' ? JSON.parse(serverData.body) : serverData.body;
  } catch (error) {
    return { embeds: [] };
  }

  const nameToEmbedId: Record<string, string> = {
    Filelions: 'filelions',
    Dood: 'dood',
    Streamwish: 'streamwish-english',
    Filemoon: 'filemoon',
  };

  if (!data.servers || !Array.isArray(data.servers)) {
    return { embeds: [] };
  }

  const embeds = [];
  for (const server of data.servers) {
    if (!server.name || !server.key) {
      continue;
    }
    if (nameToEmbedId[server.name]) {
      try {
        const linkData = await ctx.proxiedFetcher.full<any>(`${baseApiUrl}l?key=${server.key}`);
        if (linkData.statusCode !== 200) {
          continue;
        }
        const linkJson = typeof linkData.body === 'string' ? JSON.parse(linkData.body) : linkData.body;
        if (linkJson.link) {
          const embed = {
            embedId: nameToEmbedId[server.name],
            url: linkJson.link,
          };
          embeds.push(embed);
        }
      } catch (error) {
        throw new NotFoundError(`Error: ${error}`);
      }
    }
  }

  return { embeds };
}

export const primesrcScraper = makeSourcerer({
  id: 'primesrc',
  name: 'PrimeSrc',
  rank: 168,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});

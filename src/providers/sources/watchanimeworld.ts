import { load } from 'cheerio';

import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { fetchTMDBName } from '@/utils/tmdb';

const baseUrl = 'https://watchanimeworld.in';
const zephyrBaseUrl = 'https://play.zephyrflick.top';

interface ZephyrStreamResponse {
  hls: boolean;
  videoSource: string;
  securedLink: string;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD') // Decompose unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  // Get the title via the shared TMDB helper (uses ctx.fetcher, respects proxy)
  const title = await fetchTMDBName(ctx).catch(() => {
    throw new NotFoundError('Failed to fetch TMDB data');
  });
  const normalizedTitle = normalizeTitle(title);

  // Build the watchanimeworld URL
  let watchUrl: string;
  if (ctx.media.type === 'movie') {
    watchUrl = `${baseUrl}/movies/${normalizedTitle}/`;
  } else {
    const season = ctx.media.season.number;
    const episode = ctx.media.episode.number;
    watchUrl = `${baseUrl}/episode/${normalizedTitle}-${season}x${episode}/`;
  }

  ctx.progress(30);

  // Fetch the watch page
  const watchPage = await ctx.proxiedFetcher(watchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  // Extract iframe src
  const $ = load(watchPage);
  const iframeSrc = $('iframe[data-src]').attr('data-src') || $('iframe[src]').attr('src');

  if (!iframeSrc) {
    throw new NotFoundError('No iframe found on watch page');
  }

  // Extract the hash from the iframe URL
  const hashMatch = iframeSrc.match(/\/video\/([a-f0-9]+)/);
  if (!hashMatch) {
    throw new NotFoundError('Could not extract video hash from iframe');
  }

  const videoHash = hashMatch[1];
  ctx.progress(60);

  // Construct the zephyrflick API URL
  const apiUrl = `${zephyrBaseUrl}/player/index.php?data=${videoHash}&do=getVideo`;

  // Fetch stream data
  const streamResponse = await ctx.proxiedFetcher(apiUrl, {
    method: 'POST',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Referer: `${zephyrBaseUrl}/`,
      Origin: zephyrBaseUrl,
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `data=${videoHash}&do=getVideo`,
  });

  const streamData: ZephyrStreamResponse = JSON.parse(streamResponse);

  if (!streamData.hls || !streamData.videoSource) {
    throw new NotFoundError('No HLS stream found');
  }

  ctx.progress(90);

  const streamHeaders = {
    Referer: `${zephyrBaseUrl}/`,
    Origin: zephyrBaseUrl,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };

  // Return the stream
  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: streamData.videoSource,
        headers: streamHeaders,
        flags: [flags.CORS_ALLOWED],
        captions: [],
      },
    ],
  };
}

export const watchanimeworldScraper = makeSourcerer({
  id: 'watchanimeworld',
  name: 'WatchAnimeWorld',
  rank: 116,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});

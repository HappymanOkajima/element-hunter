import type { CrawlOutput } from '../types';

export interface SiteInfo {
  id: string;
  name: string;
  pageCount: number;
  path: string;
}

type SiteModule = { default: CrawlOutput };

const siteModules = import.meta.glob<SiteModule>('../../data/sites/*.json');

export async function getSiteList(): Promise<SiteInfo[]> {
  const sites: SiteInfo[] = [];

  for (const path in siteModules) {
    // tutorial.json は構造が異なるため除外
    if (path.includes('tutorial')) continue;

    try {
      const mod = await siteModules[path]();
      const data = mod.default;

      // CrawlOutput構造を持つファイルのみ追加
      if (data.siteId && data.siteName && data.metadata?.totalPages !== undefined) {
        sites.push({
          id: data.siteId,
          name: data.siteName,
          pageCount: data.metadata.totalPages,
          path,
        });
      }
    } catch (e) {
      console.warn(`Failed to load site: ${path}`, e);
    }
  }

  return sites;
}

export async function loadSite(path: string): Promise<CrawlOutput> {
  const mod = await siteModules[path]();
  return mod.default;
}

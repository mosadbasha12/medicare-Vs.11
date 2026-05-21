import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfficialHealthNewsItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt?: string;
  level?: string;
}

const CACHE_KEY = '@official_health_news';
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const OFFICIAL_FEEDS = [
  {
    source: 'منظمة الصحة العالمية',
    url: 'https://www.who.int/rss-feeds/news-english.xml',
  },
  {
    source: 'تحذيرات CDC الصحية للمسافرين',
    url: 'https://wwwnc.cdc.gov/travel/rss/notices.xml',
  },
];

const WARNING_WORDS = [
  'alert',
  'warning',
  'outbreak',
  'emergency',
  'disease outbreak',
  'level 2',
  'level 3',
  'ebola',
  'cholera',
  'mpox',
  'dengue',
  'measles',
  'polio',
  'yellow fever',
];

const decodeHtml = (text: string) => text
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/<[^>]+>/g, '')
  .trim();

const translateLevel = (title: string) => {
  if (/level 3/i.test(title)) return 'تحذير عال';
  if (/level 2/i.test(title)) return 'تنبيه صحي';
  if (/level 1/i.test(title)) return 'متابعة صحية';
  if (/outbreak|emergency|alert|warning/i.test(title)) return 'تحديث مهم';
  return undefined;
};

const getText = (item: Element, tag: string) => decodeHtml(item.getElementsByTagName(tag)[0]?.textContent || '');

const parseFeed = (xml: string, source: string): OfficialHealthNewsItem[] => {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = Array.from(doc.getElementsByTagName('item'));

  return items.map((item, index) => {
    const title = getText(item, 'title');
    const link = getText(item, 'link');
    const publishedAt = getText(item, 'pubDate');
    return {
      id: `${source}_${link || title || index}`,
      title,
      source,
      sourceUrl: link,
      publishedAt,
      level: translateLevel(title),
    };
  }).filter((item) => item.title && item.sourceUrl);
};

const officialFetch = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/rss+xml,text/xml,*/*' } });
    if (response.ok) return response.text();
  } catch {
    // Some official feeds do not allow direct browser reads.
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const proxyResponse = await fetch(proxyUrl);
  if (!proxyResponse.ok) throw new Error('feed_unavailable');
  return proxyResponse.text();
};

const rankNews = (items: OfficialHealthNewsItem[]) => {
  return [...items].sort((a, b) => {
    const aWarning = WARNING_WORDS.some((word) => a.title.toLowerCase().includes(word)) ? 1 : 0;
    const bWarning = WARNING_WORDS.some((word) => b.title.toLowerCase().includes(word)) ? 1 : 0;
    if (aWarning !== bWarning) return bWarning - aWarning;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
};

export const getOfficialHealthNews = async (): Promise<OfficialHealthNewsItem[]> => {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.updatedAt < CACHE_TTL_MS && Array.isArray(parsed.items)) {
        return parsed.items;
      }
    } catch {
      // Ignore malformed cache.
    }
  }

  const results = await Promise.allSettled(
    OFFICIAL_FEEDS.map(async (feed) => parseFeed(await officialFetch(feed.url), feed.source))
  );
  const items = rankNews(results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])).slice(0, 3);

  if (items.length > 0) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items }));
    return items;
  }

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.items)) return parsed.items.slice(0, 3);
    } catch {
      // Ignore malformed cache.
    }
  }

  return [
    {
      id: 'official_health_unavailable',
      title: 'تعذر تحديث الأخبار الصحية الرسمية حالياً. يرجى الرجوع إلى منظمة الصحة العالمية أو وزارة الصحة في بلدك عند وجود تحذير صحي.',
      source: 'مصادر صحية رسمية',
      sourceUrl: 'https://www.who.int/emergencies',
      level: 'تعذر التحديث',
    },
  ];
};

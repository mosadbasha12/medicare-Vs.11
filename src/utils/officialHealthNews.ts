import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLanguage } from '../context/LanguageContext';

export interface OfficialHealthNewsItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt?: string;
  level?: string;
  countryCode?: string;
  isLocalSource?: boolean;
}

const CACHE_KEY_PREFIX = '@official_health_news';
const COUNTRY_CACHE_KEY = '@official_health_country';
export const OFFICIAL_HEALTH_NEWS_REFRESH_MS = 60 * 60 * 1000;
const COUNTRY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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
  'تحذير',
  'تنبيه',
  'طارئ',
  'طوارئ',
  'وباء',
  'تفشي',
  'انتشار',
  'الكوليرا',
  'الحصبة',
  'شلل الأطفال',
];

const TIMEZONE_COUNTRY: Record<string, string> = {
  'Africa/Cairo': 'EG',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'Europe/London': 'GB',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
};

const COUNTRY_SOURCE_LABELS: Record<string, Record<AppLanguage, string>> = {
  EG: {
    ar: 'وزارة الصحة والسكان المصرية',
    en: 'Egyptian Ministry of Health and Population',
  },
  US: {
    ar: 'المراكز الأمريكية لمكافحة الأمراض والوقاية منها',
    en: 'U.S. Centers for Disease Control and Prevention',
  },
  GB: {
    ar: 'وزارة الصحة والرعاية الاجتماعية البريطانية',
    en: 'UK Department of Health and Social Care',
  },
};

const decodeHtml = (text: string) => text
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&#x27;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getLanguageRegion = () => {
  if (typeof navigator === 'undefined') return '';
  const locale = navigator.languages?.[0] || navigator.language || '';
  const region = locale.split('-')[1];
  return region ? region.toUpperCase() : '';
};

const getTimezoneCountry = () => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[timezone] || '';
  } catch {
    return '';
  }
};

const fetchCountryFromIp = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) return '';
    const data = await response.json();
    return String(data?.country_code || data?.country || '').toUpperCase();
  } catch {
    return '';
  }
};

const getUserCountryCode = async () => {
  const cached = await AsyncStorage.getItem(COUNTRY_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.updatedAt < COUNTRY_CACHE_TTL_MS && parsed.countryCode) {
        return String(parsed.countryCode).toUpperCase();
      }
    } catch {
      // Ignore malformed cache.
    }
  }

  const countryCode = (await fetchCountryFromIp()) || getLanguageRegion() || getTimezoneCountry() || 'EG';
  await AsyncStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), countryCode }));
  return countryCode;
};

const officialFetch = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/rss+xml,application/json,text/xml,text/html,*/*' } });
    if (response.ok) return response.text();
  } catch {
    // Some official sources do not allow direct browser reads.
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const proxyResponse = await fetch(proxyUrl);
  if (!proxyResponse.ok) throw new Error('official_source_unavailable');
  return proxyResponse.text();
};

const translateLevel = (title: string, language: AppLanguage) => {
  const lower = title.toLowerCase();
  const labels = language === 'ar'
    ? { high: 'تحذير عال', medium: 'تنبيه صحي', follow: 'متابعة صحية', important: 'تحديث مهم' }
    : { high: 'High alert', medium: 'Health advisory', follow: 'Health watch', important: 'Important update' };

  if (/level 3|تحذير عال/i.test(lower)) return labels.high;
  if (/level 2|تنبيه/i.test(lower)) return labels.medium;
  if (/level 1|متابعة/i.test(lower)) return labels.follow;
  if (/outbreak|emergency|alert|warning|تفشي|وباء|طوارئ|تحذير/i.test(lower)) return labels.important;
  return undefined;
};

const parseRssFeed = (xml: string, source: string, language: AppLanguage, countryCode?: string, isLocalSource = false): OfficialHealthNewsItem[] => {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = Array.from(doc.getElementsByTagName('item'));

  return items.map((item, index) => {
    const title = decodeHtml(item.getElementsByTagName('title')[0]?.textContent || '');
    const link = decodeHtml(item.getElementsByTagName('link')[0]?.textContent || '');
    const publishedAt = decodeHtml(item.getElementsByTagName('pubDate')[0]?.textContent || '');
    return {
      id: `${source}_${link || title || index}`,
      title,
      source,
      sourceUrl: link,
      publishedAt,
      level: translateLevel(title, language),
      countryCode,
      isLocalSource,
    };
  }).filter((item) => item.title && item.sourceUrl);
};

const parseAtomFeed = (xml: string, source: string, language: AppLanguage, countryCode?: string, isLocalSource = false): OfficialHealthNewsItem[] => {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const entries = Array.from(doc.getElementsByTagName('entry'));

  return entries.map((entry, index) => {
    const title = decodeHtml(entry.getElementsByTagName('title')[0]?.textContent || '');
    const linkNode = Array.from(entry.getElementsByTagName('link')).find((node) => node.getAttribute('href'));
    const link = linkNode?.getAttribute('href') || '';
    const publishedAt = decodeHtml(entry.getElementsByTagName('updated')[0]?.textContent || entry.getElementsByTagName('published')[0]?.textContent || '');
    return {
      id: `${source}_${link || title || index}`,
      title,
      source,
      sourceUrl: link,
      publishedAt,
      level: translateLevel(title, language),
      countryCode,
      isLocalSource,
    };
  }).filter((item) => item.title && item.sourceUrl);
};

const fetchEgyptMinistryNews = async (language: AppLanguage): Promise<OfficialHealthNewsItem[]> => {
  const source = COUNTRY_SOURCE_LABELS.EG[language];
  const html = await officialFetch('https://www.mohp.gov.eg/News.aspx');
  const matches = Array.from(html.matchAll(/<a[^>]+href=["'](?<href>NewsDetails\.aspx\?subject_id=\d+)["'][^>]*>(?<text>[\s\S]*?)<\/a>/gi));
  const seen = new Set<string>();

  return matches.map((match, index) => {
    const href = match.groups?.href || '';
    const title = decodeHtml(match.groups?.text || '');
    if (!href || !title || title.length < 12 || seen.has(href)) return null;
    seen.add(href);
    return {
      id: `EG_MOHP_${href}`,
      title,
      source,
      sourceUrl: `https://www.mohp.gov.eg/${href}`,
      publishedAt: String(Date.now() - index),
      level: translateLevel(title, language),
      countryCode: 'EG',
      isLocalSource: true,
    };
  }).filter(Boolean).slice(0, 3) as OfficialHealthNewsItem[];
};

const fetchCountryNews = async (countryCode: string, language: AppLanguage): Promise<OfficialHealthNewsItem[]> => {
  if (countryCode === 'EG') return fetchEgyptMinistryNews(language);

  if (countryCode === 'US') {
    const xml = await officialFetch('https://wwwnc.cdc.gov/travel/rss/notices.xml');
    return parseRssFeed(xml, COUNTRY_SOURCE_LABELS.US[language], language, 'US', true);
  }

  if (countryCode === 'GB') {
    const xml = await officialFetch('https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom');
    return parseAtomFeed(xml, COUNTRY_SOURCE_LABELS.GB[language], language, 'GB', true);
  }

  return [];
};

const fetchWhoNews = async (language: AppLanguage): Promise<OfficialHealthNewsItem[]> => {
  const culture = language === 'ar' ? 'ar' : 'en';
  const source = language === 'ar' ? 'منظمة الصحة العالمية' : 'World Health Organization';
  const url = `https://www.who.int/api/news/newsitems?sf_provider=OpenAccessDataProvider&sf_culture=${culture}&$top=6&$orderby=PublicationDateAndTime%20desc&$select=Title,ItemDefaultUrl,FormatedDate,NewsType&$filter=publishingoffices/any(s:s%20eq%20aeebab07-3d0c-4a24-b6ef-7c11b7139e43%20or%20s%20eq%20df302c0e-1f59-4efb-b276-d154122d3760%20or%20s%20eq%20db6766a8-4c21-4211-af4d-947fb91c0091)`;
  const json = JSON.parse(await officialFetch(url));
  const values = Array.isArray(json?.value) ? json.value : [];

  return values.map((item: any, index: number) => {
    const title = decodeHtml(String(item?.Title || ''));
    const path = String(item?.ItemDefaultUrl || '');
    const sourceUrl = path.startsWith('http') ? path : `https://www.who.int${path.startsWith('/') ? path : `/${path}`}`;
    return {
      id: `WHO_${culture}_${path || title || index}`,
      title,
      source,
      sourceUrl,
      publishedAt: item?.FormatedDate,
      level: item?.NewsType ? decodeHtml(String(item.NewsType)) : translateLevel(title, language),
      isLocalSource: false,
    };
  }).filter((item: OfficialHealthNewsItem) => item.title && item.sourceUrl);
};

const rankNews = (items: OfficialHealthNewsItem[]) => {
  return [...items].sort((a, b) => {
    if (a.isLocalSource !== b.isLocalSource) return a.isLocalSource ? -1 : 1;
    const aWarning = WARNING_WORDS.some((word) => a.title.toLowerCase().includes(word.toLowerCase())) ? 1 : 0;
    const bWarning = WARNING_WORDS.some((word) => b.title.toLowerCase().includes(word.toLowerCase())) ? 1 : 0;
    if (aWarning !== bWarning) return bWarning - aWarning;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
};

export const getOfficialHealthNews = async (language: AppLanguage = 'ar'): Promise<OfficialHealthNewsItem[]> => {
  const countryCode = await getUserCountryCode();
  const cacheKey = `${CACHE_KEY_PREFIX}_${language}_${countryCode}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.updatedAt < OFFICIAL_HEALTH_NEWS_REFRESH_MS && Array.isArray(parsed.items)) {
        return parsed.items;
      }
    } catch {
      // Ignore malformed cache.
    }
  }

  const [countryResult, whoResult] = await Promise.allSettled([
    fetchCountryNews(countryCode, language),
    fetchWhoNews(language),
  ]);
  const countryItems = countryResult.status === 'fulfilled' ? countryResult.value : [];
  const whoItems = whoResult.status === 'fulfilled' ? whoResult.value : [];
  const items = [
    ...countryItems.slice(0, 1),
    ...rankNews([...whoItems, ...countryItems.slice(1)]).slice(0, countryItems.length > 0 ? 2 : 3),
  ].slice(0, 3);

  if (items.length > 0) {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ updatedAt: Date.now(), countryCode, items }));
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
      title: language === 'ar'
        ? 'تعذر تحديث الأخبار الصحية الرسمية حالياً. يرجى الرجوع إلى منظمة الصحة العالمية أو وزارة الصحة في بلدك عند وجود تحذير صحي.'
        : 'Official health updates are temporarily unavailable. Please check WHO or your national health ministry for urgent advisories.',
      source: language === 'ar' ? 'مصادر صحية رسمية' : 'Official health sources',
      sourceUrl: language === 'ar' ? 'https://www.who.int/ar/emergencies' : 'https://www.who.int/emergencies',
      level: language === 'ar' ? 'تعذر التحديث' : 'Update unavailable',
    },
  ];
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MedicineCatalogItem } from '../types';

const MEDICINE_CACHE_KEY = '@medicine_catalog_cache';
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

export const LOCAL_MEDICINE_CATALOG: MedicineCatalogItem[] = [
  { med: 'باراسيتامول 500mg', dosage: 'قرص بعد الأكل', timesPerDay: 3, durationDays: 3, instructions: 'للحرارة أو الألم. لا تتجاوز الجرعة اليومية.', source: 'local' },
  { med: 'إيبوبروفين 400mg', dosage: 'قرص بعد الأكل', timesPerDay: 2, durationDays: 3, instructions: 'تجنب استخدامه مع قرحة المعدة إلا بعد مراجعة الطبيب.', source: 'local' },
  { med: 'أموكسيسيلين/كلافولانات 1g', dosage: 'قرص كل 12 ساعة', timesPerDay: 2, durationDays: 7, instructions: 'يجب إكمال مدة المضاد الحيوي كاملة.', source: 'local' },
  { med: 'أزيثرومايسين 500mg', dosage: 'قرص يومياً', timesPerDay: 1, durationDays: 3, instructions: 'يفضل في نفس الموعد يومياً.', source: 'local' },
  { med: 'سيتريزين 10mg', dosage: 'قرص مساءً', timesPerDay: 1, durationDays: 5, instructions: 'قد يسبب النعاس.', source: 'local' },
  { med: 'أوميبرازول 20mg', dosage: 'كبسولة قبل الإفطار', timesPerDay: 1, durationDays: 14, instructions: 'يؤخذ قبل الأكل بنصف ساعة.', source: 'local' },
  { med: 'ميتفورمين 500mg', dosage: 'قرص بعد الأكل', timesPerDay: 2, durationDays: 30, instructions: 'متابعة السكر حسب إرشادات الطبيب.', source: 'local' },
  { med: 'فيتامين د 50000 IU', dosage: 'كبسولة أسبوعياً', timesPerDay: 1, durationDays: 56, instructions: 'جرعة أسبوعية حسب نتيجة التحليل.', source: 'local' },
  { med: 'أملوديبين 5mg', dosage: 'قرص يومياً', timesPerDay: 1, durationDays: 30, instructions: 'لمرضى الضغط حسب قرار الطبيب.', source: 'local' },
  { med: 'لوراتادين 10mg', dosage: 'قرص يومياً', timesPerDay: 1, durationDays: 7, instructions: 'للحساسية. يفضل مراجعة الطبيب عند استمرار الأعراض.', source: 'local' },
  { med: 'سالبوتامول inhaler', dosage: 'بخة عند اللزوم', timesPerDay: 2, durationDays: 7, instructions: 'لا يستخدم كبديل لخطة علاج الربو المنتظمة.', source: 'local' },
  { med: 'ديكلوفيناك 50mg', dosage: 'قرص بعد الأكل', timesPerDay: 2, durationDays: 3, instructions: 'تجنب استخدامه مع قرحة المعدة أو أمراض الكلى إلا بإرشاد الطبيب.', source: 'local' },
];

type MedicineCache = {
  updatedAt: string;
  items: MedicineCatalogItem[];
};

const normalize = (value: string) => value.trim().toLowerCase();

const uniqueByName = (items: MedicineCatalogItem[]): MedicineCatalogItem[] => {
  const seen = new Set<string>();
  const result: MedicineCatalogItem[] = [];
  for (const item of items) {
    const key = normalize(item.med);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

const mapRemoteName = (name: string, source: MedicineCatalogItem['source']): MedicineCatalogItem => ({
  med: name,
  dosage: 'حدد الجرعة حسب حالة المريض',
  timesPerDay: 1,
  durationDays: 7,
  instructions: 'دواء معروف من مصدر دوائي عام. عدل الجرعة والمدة حسب التشخيص.',
  source,
  updatedAt: new Date().toISOString(),
});

const fetchRxNavMedicines = async (query: string): Promise<MedicineCatalogItem[]> => {
  const term = encodeURIComponent(query);
  const response = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${term}`);
  if (!response.ok) return [];
  const data = await response.json();
  const groups = data?.drugGroup?.conceptGroup || [];
  const names: string[] = [];
  for (const group of groups) {
    for (const prop of group?.conceptProperties || []) {
      if (prop?.name) names.push(prop.name);
    }
  }
  return names.slice(0, 40).map((name) => mapRemoteName(name, 'rxnav'));
};

const fetchOpenFdaMedicines = async (query: string): Promise<MedicineCatalogItem[]> => {
  const term = encodeURIComponent(query);
  const response = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:${term}*&limit=20`);
  if (!response.ok) return [];
  const data = await response.json();
  const names = (data?.results || [])
    .flatMap((item: any) => item?.openfda?.brand_name || item?.openfda?.generic_name || [])
    .filter(Boolean);
  return names.map((name: string) => mapRemoteName(name, 'openfda'));
};

export const getCachedMedicineCatalog = async (): Promise<MedicineCatalogItem[]> => {
  try {
    const stored = await AsyncStorage.getItem(MEDICINE_CACHE_KEY);
    if (!stored) return LOCAL_MEDICINE_CATALOG;
    const cache: MedicineCache = JSON.parse(stored);
    const age = Date.now() - new Date(cache.updatedAt).getTime();
    if (age > FIVE_HOURS_MS) return LOCAL_MEDICINE_CATALOG;
    return uniqueByName([...LOCAL_MEDICINE_CATALOG, ...cache.items]);
  } catch {
    return LOCAL_MEDICINE_CATALOG;
  }
};

export const searchMedicineCatalog = async (query: string): Promise<MedicineCatalogItem[]> => {
  const cleanQuery = query.trim();
  const cached = await getCachedMedicineCatalog();
  const localMatches = cached.filter((item) => normalize(`${item.med} ${item.dosage}`).includes(normalize(cleanQuery)));

  if (cleanQuery.length < 3) return localMatches.length ? localMatches : cached;

  try {
    const [rxNav, openFda] = await Promise.allSettled([
      fetchRxNavMedicines(cleanQuery),
      fetchOpenFdaMedicines(cleanQuery),
    ]);
    const remoteItems = [
      ...(rxNav.status === 'fulfilled' ? rxNav.value : []),
      ...(openFda.status === 'fulfilled' ? openFda.value : []),
    ];
    const nextItems = uniqueByName([...cached, ...remoteItems]);
    await AsyncStorage.setItem(MEDICINE_CACHE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), items: nextItems }));
    return uniqueByName([...localMatches, ...remoteItems]).slice(0, 60);
  } catch {
    return localMatches.length ? localMatches : cached;
  }
};

export const addMedicineToCatalog = async (medicine: MedicineCatalogItem): Promise<MedicineCatalogItem[]> => {
  const current = await getCachedMedicineCatalog();
  const nextItem: MedicineCatalogItem = {
    ...medicine,
    timesPerDay: medicine.timesPerDay || 1,
    durationDays: medicine.durationDays || 1,
    dosage: medicine.dosage || 'تحدد عند إضافة الدواء للمريض',
    instructions: medicine.instructions || 'تحدد التعليمات حسب حالة المريض.',
    source: medicine.source || 'local',
    updatedAt: new Date().toISOString(),
  };
  const nextItems = uniqueByName([nextItem, ...current]);
  await AsyncStorage.setItem(MEDICINE_CACHE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), items: nextItems }));
  return nextItems;
};

export const isKnownMedicine = (name: string, catalog: MedicineCatalogItem[]): boolean => {
  const target = normalize(name);
  if (target.length < 3) return false;
  return catalog.some((item) => normalize(item.med) === target || normalize(item.med).includes(target) || target.includes(normalize(item.med)));
};

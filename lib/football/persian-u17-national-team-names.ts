const COUNTRY_NAMES_FA: Record<string, string> = {
  "france": "فرانسه",
  "saudi arabia": "عربستان سعودی",
  "ecuador": "اکوادور",
  "uganda": "اوگاندا",
  "greece": "یونان",
  "panama": "پاناما",
  "denmark": "دانمارک",
  "australia": "استرالیا",
  "chile": "شیلی",
  "algeria": "الجزایر",
  "mexico": "مکزیک",
  "romania": "رومانی",
  "brazil": "برزیل",
  "ireland": "ایرلند",
  "republic of ireland": "جمهوری ایرلند",
  "dominican republic": "جمهوری دومینیکن",
  "montenegro": "مونته‌نگرو",
  "cameroon": "کامرون",
  "venezuela": "ونزوئلا",
  "tanzania": "تانزانیا",
  "costa rica": "کاستاریکا",
  "japan": "ژاپن",
  "colombia": "کلمبیا",
  "serbia": "صربستان",
  "honduras": "هندوراس",
  "cote d ivoire": "ساحل عاج",
  "ivory coast": "ساحل عاج",
  "uzbekistan": "ازبکستان",
  "fiji": "فیجی",
  "morocco": "مراکش",
  "senegal": "سنگال",
  "croatia": "کرواسی",
  "italy": "ایتالیا",
  "jamaica": "جامائیکا",
  "spain": "اسپانیا",
  "china": "چین",
  "mali": "مالی",
  "new zealand": "نیوزیلند",
  "cuba": "کوبا",
  "tajikistan": "تاجیکستان",
  "belgium": "بلژیک",
  "vietnam": "ویتنام",
  "egypt": "مصر",
  "argentina": "آرژانتین",
  "qatar": "قطر",
  "mozambique": "موزامبیک",
  "uruguay": "اروگوئه",
  "south korea": "کره جنوبی",
  "korea republic": "کره جنوبی",
  "new caledonia": "کالدونیای جدید",
  "haiti": "هائیتی",
};

function normalizeCountryName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Translate youth national sides as country name + "under 17 years". */
export function persianU17NationalTeamName(sourceName: string): string | null {
  const match = sourceName.trim().match(/^(.*?)(?:\s+(?:u[\s-]?17|under[\s-]?17))(?:\s+(?:national\s+)?team)?$/i);
  if (!match) return null;
  const country = match[1].trim();
  if (!country) return null;
  return `${COUNTRY_NAMES_FA[normalizeCountryName(country)] ?? country} زیر ۱۷ سال`;
}

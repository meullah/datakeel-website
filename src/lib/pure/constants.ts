// Form options and copy shared by the Form component, the form island and the /sent/ pages. No imports.

export type FormVariant = 'readiness-review' | 'contact';

export const companySizes = ['1–49 people', '50–249 people', '250–999 people', '1,000+ people'] as const;

// ISO 3166-1 alpha-2, all 249 codes. Names come from Intl (English, CLDR).
const countryCodes =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';

// ponytail: a function, not a constant, so the island bundle drops it (only the Form component calls it).
export const countries = (): string[] => {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  return countryCodes.split(' ').map((c) => names.of(c)!).sort((a, b) => a.localeCompare(b, 'en'));
};

/** Required fields per form; everything else is optional. */
export const requiredFields: Record<FormVariant, readonly string[]> = {
  'readiness-review': ['name', 'email', 'company', 'message'],
  contact: ['name', 'email', 'company', 'message'],
};

export const fieldMessages: Record<FormVariant, Record<string, string>> = {
  'readiness-review': {
    name: 'Please add your name.',
    email: 'Please add your work email so we can reply.',
    company: 'Please add your company name.',
    message: 'Please tell us a little about your data challenge.',
  },
  contact: {
    name: 'Please add your name.',
    email: 'Please add your work email so we can reply.',
    company: 'Please add your company name.',
    message: 'Please add a message.',
  },
};

/** "One field needs your attention: Work email." */
export const errorSummary = (labels: string[]) =>
  labels.length === 1
    ? `One field needs your attention: ${labels[0]}.`
    : `${labels.length} fields need your attention: ${labels.join(', ')}.`;

export const sendingLabel = 'Sending…';

/** First whitespace-separated token of the name, or "". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

const thanks = (name: string) => {
  const first = firstName(name);
  return first ? `Thanks, ${first}.` : 'Thanks.';
};

// The note is followed by the email link where it is rendered (pure code holds no config).
export const successCopy: Record<FormVariant, { label: string; heading: (name: string) => string; note?: string }> = {
  'readiness-review': {
    label: 'Request sent',
    heading: (name) => `${thanks(name)} We’ll reply within one business day with details and pricing.`,
    note: 'If it’s urgent, email',
  },
  contact: {
    label: 'Message sent',
    heading: (name) => `${thanks(name)} We’ll get back to you within one business day.`,
  },
};

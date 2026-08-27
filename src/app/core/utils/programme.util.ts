export interface CoverTheme {
  url: string;
  gradient: string;
  icon: string;
}

const FALLBACKS: CoverTheme[] = [
  {
    url: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80',
    gradient: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
    icon: 'bi-mortarboard',
  },
  {
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?auto=format&fit=crop&w=1400&q=80',
    gradient: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
    icon: 'bi-heart-pulse',
  },
];

const coverVersions = new Map<string, number>();

function isPresignedStorageUrl(url: string): boolean {
  return /[?&]X-Amz-Signature=/i.test(url) || /[?&]X-Amz-Algorithm=/i.test(url);
}

/** Bust browser img cache after a cover upload so cards reload the new image. */
export function bumpCoverImageVersion(id: string): number {
  const next = (coverVersions.get(id) ?? 0) + 1;
  coverVersions.set(id, next);
  return next;
}

export function coverImageSrc(url: string, programmeId = ''): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return trimmed;
  // Never append params to R2/S3 presigned URLs — it invalidates the signature.
  if (isPresignedStorageUrl(trimmed)) return trimmed;
  const version = programmeId ? coverVersions.get(programmeId) ?? 0 : 0;
  if (version <= 0) return trimmed;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${version}`;
}

export function programmeCoverUrl(title: string, id: string, coverImageUrl?: string | null): string {
  const custom = (coverImageUrl || '').trim();
  if (custom) {
    return coverImageSrc(custom, id);
  }
  return coverTheme(title, id).url;
}

export function coverTheme(title: string, id = '', coverImageUrl?: string | null): CoverTheme {
  const t = (title || '').toLowerCase();
  let theme: CoverTheme;
  if (/health|nurs|medic|clinic|pharma|care|midwif|mbchb|surgery|anatomy/.test(t)) {
    theme = {
      url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?auto=format&fit=crop&w=1400&q=80',
      gradient: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
      icon: 'bi-heart-pulse',
    };
  } else if (/engineer|civil|mechanic/.test(t)) {
    theme = {
      url: 'https://images.unsplash.com/photo-1581092795442-8dce0b4d8f0f?auto=format&fit=crop&w=1400&q=80',
      gradient: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
      icon: 'bi-gear-wide-connected',
    };
  } else {
    const hash = [...(id || title || '')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    theme = FALLBACKS[hash % FALLBACKS.length];
  }
  const custom = (coverImageUrl || '').trim();
  if (custom) {
    return { ...theme, url: custom };
  }
  return theme;
}

export const AFFILIATED_INSTITUTIONS = [
  'Veneranda University',
  'Kenya Medical Training College',
  'University of Nairobi',
  'Kenyatta University',
  'Moi University',
  'Jomo Kenyatta University of Agriculture and Technology',
  'Egerton University',
  'Maseno University',
  'Mount Kenya University',
  'Kabarak University',
  'Strathmore University',
  'Technical University of Kenya',
  'Masinde Muliro University of Science and Technology',
  'Dedan Kimathi University of Technology',
  'Catholic University of Eastern Africa',
  'Daystar University',
] as const;

export const DEFAULT_INSTITUTION = AFFILIATED_INSTITUTIONS[0];

const CUSTOM_INSTITUTIONS_KEY = 'vu_custom_institutions';

function readCustomInstitutions(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_INSTITUTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || '').trim())
      .filter((item) => !!item);
  } catch {
    return [];
  }
}

function writeCustomInstitutions(items: string[]): void {
  try {
    localStorage.setItem(CUSTOM_INSTITUTIONS_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Built-in list plus any institutions the user has added in this browser. */
export function allAffiliatedInstitutions(extra: string | null | undefined = null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  for (const item of AFFILIATED_INSTITUTIONS) push(item);
  for (const item of readCustomInstitutions()) push(item);
  if (extra) push(extra);
  return out;
}

/** Persist a new institution so it appears in future pickers. */
export function rememberAffiliatedInstitution(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const existing = allAffiliatedInstitutions();
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return existing.find((item) => item.toLowerCase() === trimmed.toLowerCase()) || trimmed;
  }
  writeCustomInstitutions([...readCustomInstitutions(), trimmed]);
  return trimmed;
}

export const PROGRAMME_CATEGORIES = ['Certificate', 'Diploma', 'Bachelor', 'Masters', 'Doctorate', 'Other'] as const;
export type ProgrammeCategory = (typeof PROGRAMME_CATEGORIES)[number];

export function programmeCategory(title: string): ProgrammeCategory {
  const t = (title || '').toLowerCase();
  if (/\b(phd|dphil|doctor of|doctorate)\b/.test(t)) return 'Doctorate';
  if (/\b(master|masters|msc|mba|ma)\b/.test(t)) return 'Masters';
  if (/\b(bachelor|mbchb|degree|bsc|ba|llb|beng)\b/.test(t)) return 'Bachelor';
  if (/\bdiploma\b/.test(t)) return 'Diploma';
  if (/\b(certificate|cert)\b/.test(t)) return 'Certificate';
  return 'Other';
}

export function programmeHeading(
  programme: { title?: string | null; abbreviation?: string | null } | null | undefined,
  fallback = '',
): string {
  const title = (programme?.title || fallback).trim();
  const abbreviation = (programme?.abbreviation || '').trim();
  if (!title) return abbreviation ? `(${abbreviation})` : '';
  return abbreviation ? `(${abbreviation}) ${title}` : title;
}

export function formatKes(amount?: number | null, currency = 'KES'): string {
  if (amount == null) return '';
  if (Number(amount) === 0) return 'Free';
  return `${currency} ${Number(amount).toLocaleString('en-KE')}`;
}

export type NodeKind = 'PROGRAMME' | 'YEAR' | 'SEMESTER' | 'UNIT' | 'OUTLINE';

export function childKind(parentKind?: string | null): NodeKind {
  switch (parentKind) {
    case 'PROGRAMME':
      return 'YEAR';
    case 'YEAR':
      return 'SEMESTER';
    case 'SEMESTER':
      return 'UNIT';
    default:
      return 'OUTLINE';
  }
}

export function defaultPrice(kind?: string | null): number {
  switch (kind) {
    case 'PROGRAMME':
      return 250000;
    case 'YEAR':
      return 80000;
    case 'SEMESTER':
      return 40000;
    case 'UNIT':
      return 15000;
    default:
      return 0;
  }
}

export function priceFor(item: { priceAmount?: number | null; nodeKind?: string | null }): number {
  if (item.priceAmount != null) return Number(item.priceAmount);
  return defaultPrice(item.nodeKind);
}

export function kindLabel(kind?: string | null): string {
  switch (kind) {
    case 'PROGRAMME':
      return 'Programme';
    case 'YEAR':
      return 'Year';
    case 'SEMESTER':
      return 'Semester';
    case 'UNIT':
      return 'Course unit';
    case 'FREE':
      return 'Trial';
    default:
      return 'Outline';
  }
}

export interface ProgrammeFaculty {
  name: string;
  role: string;
  focus: string;
}

export interface ProgrammeStory {
  category: ProgrammeCategory;
  about: string;
  howToEnroll: string[];
  affiliatedNote: string;
  faculty: ProgrammeFaculty[];
  youGet: string[];
  youBecome: string[];
  career: string;
}

const FACULTY_NAMES = [
  'Dr. Jane Wanjiku',
  'Dr. James Omondi',
  'Amina Hassan, MSc',
  'Peter Kamau, MPH',
  'Grace Atieno, MMed',
  'Samuel Njoroge, PhD',
  'Mercy Chebet, MSc',
  'David Mutiso, MEd',
  'Faith Wambui, MNurs',
  'Daniel Kiprop, MEng',
];

function hashSeed(value: string): number {
  return [...value].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function pickName(id: string, index: number): string {
  return FACULTY_NAMES[(hashSeed(id) + index * 3) % FACULTY_NAMES.length];
}

export function programmeStory(
  programme: { id: string; title: string; description?: string; affiliatedInstitution?: string | null },
  unitTitles: string[] = [],
): ProgrammeStory {
  const category = programmeCategory(programme.title);
  const title = programme.title || 'this programme';
  const institution = programme.affiliatedInstitution || DEFAULT_INSTITUTION;
  const t = title.toLowerCase();
  const health = /health|nurs|medic|clinic|pharma|care|midwif|mbchb|surgery|anatomy/.test(t);
  const engineering = /engineer|civil|mechanic|ict|computer|software/.test(t);
  const about =
    programme.description?.trim() ||
    (health
      ? `${title} prepares you for competent practice in hospitals, clinics, and community settings, combining classroom learning with skills-lab and field work.`
      : engineering
        ? `${title} builds the theory and practical skills needed to design, build, and maintain systems used in industry and public works.`
        : `${title} is a structured learning path from ${institution}, covering the core knowledge, skills, and professional conduct expected of graduates.`);

  const unitsNote = unitTitles.length
    ? ` Units currently published include ${unitTitles.slice(0, 3).join(', ')}${unitTitles.length > 3 ? ', and more' : ''}.`
    : '';

  const faculty: ProgrammeFaculty[] = health
    ? [
        { name: pickName(programme.id, 0), role: 'Programme coordinator', focus: 'Clinical medicine and training oversight' },
        { name: pickName(programme.id, 1), role: 'Senior lecturer', focus: 'Community health and primary care' },
        { name: pickName(programme.id, 2), role: 'Clinical tutor', focus: 'Skills laboratory and hospital attachments' },
      ]
    : engineering
      ? [
          { name: pickName(programme.id, 0), role: 'Programme coordinator', focus: 'Curriculum and industry placement' },
          { name: pickName(programme.id, 1), role: 'Senior lecturer', focus: 'Design studio and applied theory' },
          { name: pickName(programme.id, 2), role: 'Workshop tutor', focus: 'Practicals and project supervision' },
        ]
      : [
          { name: pickName(programme.id, 0), role: 'Programme coordinator', focus: 'Academic guidance and assessment' },
          { name: pickName(programme.id, 1), role: 'Senior lecturer', focus: 'Core modules and seminars' },
          { name: pickName(programme.id, 2), role: 'Tutorial fellow', focus: 'Tutorials and learner support' },
        ];

  const youGet = health
    ? [
        'Classroom teaching mapped to national clinical competencies',
        'Skills-lab practice and supervised hospital or community attachments',
        'Notes, slides, and assessments for each subscribed course unit',
        'A recognised award pathway affiliated to ' + institution,
      ]
    : [
        'A published outline of years, semesters, and course units',
        'Teaching materials and assessments once you subscribe',
        'Guidance from faculty based at ' + institution,
        'Progress from foundation modules through professional practice',
      ];

  const youBecome = health
    ? [
        'A clinician or health worker ready for hospitals, clinics, and community practice',
        'Able to assess, treat, and follow up patients under professional guidelines',
        'Eligible to pursue licensing, internship, or further specialisation where applicable',
      ]
    : engineering
      ? [
          'A practitioner able to apply engineering methods to real projects',
          'Ready for internships, site work, or graduate training schemes',
          'Prepared for professional registration pathways in your field',
        ]
      : [
          'A graduate of ' + title + ' with applied knowledge in the field',
          'Ready for entry-level professional work or further study',
          'Able to demonstrate the competencies taught across the programme',
        ];

  const career = health
    ? `Graduates typically work in hospitals, health centres, NGOs, and county health services, or continue into specialised clinical training.`
    : engineering
      ? `Graduates typically join consultancies, contractors, utilities, or public works, or continue to postgraduate engineering study.`
      : `On completion you join the professional pathway linked to ${title}, whether that is employment, further study, or both.`;

  return {
    category,
    about: about + unitsNote,
    howToEnroll: [
      'Join the programme to add it to your catalogue. Joining is free and does not unlock paid content.',
      'Open the programme page and subscribe at the level you need: the whole programme, a year, a semester, or a single course unit.',
      'Coverage only goes downward. A unit unlocks that unit; a semester unlocks its units; a year unlocks that year’s semesters and units; the programme unlocks everything.',
      'After you subscribe, open a course unit to read notes, slides, and other teaching materials.',
    ],
    affiliatedNote: `${title} is affiliated to ${institution}. Teaching, assessment, and award pathways follow that institution’s academic framework.`,
    faculty,
    youGet,
    youBecome,
    career,
  };
}

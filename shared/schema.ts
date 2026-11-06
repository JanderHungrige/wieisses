// One Zod schema per entity; request validators, admin forms and TypeScript types derive from
// these (doc 01). Server and web import this same file.
import { z } from 'zod';
import { ANIMAL_IDS, COLOUR_IDS, FRUIT_IDS, QUESTION_KINDS } from './catalog.ts';

export const MEDIA_FILE = /^[a-f0-9]{32}\.(png|jpg|webp|mp3|m4a|ogg|wav)$/;

const id = z.int().positive();
const sort = z.int().min(0).max(10_000);
const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Farbe als #rrggbb');
const icon = z.string().trim().min(1).max(16);
const mediaUrl = z.string().regex(/^\/media\/[a-f0-9]{32}\.(png|jpg|webp|mp3|m4a|ogg|wav)$/);
const grade = z.int().min(1).max(6);

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

// ── Content ────────────────────────────────────────────────────────────────

export const TopicSchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  color: hexColour,
  icon,
  imageUrl: mediaUrl.nullable(),
  sort,
  active: z.boolean(),
});
export const TopicCreate = TopicSchema.omit({ id: true }).extend({
  imageUrl: mediaUrl.nullable().default(null),
  sort: sort.default(0),
  active: z.boolean().default(true),
});
export const TopicPatch = TopicSchema.omit({ id: true }).partial();
export type Topic = z.infer<typeof TopicSchema>;

export const QuestionKindSchema = z.enum(QUESTION_KINDS);
export const FrequencySchema = z.enum(['core', 'extended']);

export const QuestionSchema = z.object({
  id,
  topicId: id,
  kind: QuestionKindSchema,
  multi: z.boolean(),
  text: z.string().trim().min(1).max(200),
  icon,
  imageUrl: mediaUrl.nullable(),
  audioUrl: mediaUrl.nullable(),
  frequency: FrequencySchema,
  sort,
  active: z.boolean(),
});
export const QuestionCreate = QuestionSchema.omit({ id: true, topicId: true }).extend({
  multi: z.boolean().default(false),
  imageUrl: mediaUrl.nullable().default(null),
  audioUrl: mediaUrl.nullable().default(null),
  frequency: FrequencySchema.default('core'),
  sort: sort.default(0),
  active: z.boolean().default(true),
});
export const QuestionPatch = QuestionSchema.omit({ id: true, topicId: true }).partial();
export type Question = z.infer<typeof QuestionSchema>;

export const OptionSchema = z.object({
  id,
  questionId: id,
  label: z.string().trim().min(1).max(40),
  icon,
  imageUrl: mediaUrl.nullable(),
  sort,
  active: z.boolean(),
});
export const OptionCreate = OptionSchema.omit({ id: true, questionId: true }).extend({
  imageUrl: mediaUrl.nullable().default(null),
  sort: sort.default(0),
  active: z.boolean().default(true),
});
export const OptionPatch = OptionSchema.omit({ id: true, questionId: true }).partial();
export type AnswerOption = z.infer<typeof OptionSchema>;

// ── Settings ───────────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  title: z.string().trim().min(1).max(40),
  extendedWeekdays: z.array(z.int().min(1).max(7)).max(7).refine(unique, 'Wochentage doppelt'),
  autoRead: z.boolean(),
  speechRate: z.number().min(0.6).max(1.3),
  idleSeconds: z.int().min(20).max(600),
  grades: z.array(grade).min(1).max(6).refine(unique, 'Klassen doppelt'),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  title: 'Wie isses?',
  extendedWeekdays: [5],
  autoRead: true,
  speechRate: 0.9,
  idleSeconds: 90,
  grades: [1, 2, 3, 4],
});

// ── Kiosk ──────────────────────────────────────────────────────────────────

export const CodePicksSchema = z.object({
  animal: z.enum(ANIMAL_IDS),
  color: z.enum(COLOUR_IDS),
  fruit: z.enum(FRUIT_IDS),
});
export const NewCodeSchema = CodePicksSchema.extend({ grade });

export const AnswerInputSchema = z.object({
  questionId: id,
  value: z.int().optional(),
  optionIds: z.array(id).max(20).optional(),
});
export const SubmissionInputSchema = z.object({
  topicId: id,
  answers: z.array(AnswerInputSchema).max(50),
});
export type AnswerInput = z.infer<typeof AnswerInputSchema>;
export type SubmissionInput = z.infer<typeof SubmissionInputSchema>;

export type KioskOption = Pick<AnswerOption, 'id' | 'label' | 'icon' | 'imageUrl'>;
export type KioskQuestion = Pick<Question, 'id' | 'kind' | 'multi' | 'text' | 'icon' | 'imageUrl' | 'audioUrl'> & {
  options: KioskOption[];
};
export type KioskTopic = Pick<Topic, 'id' | 'name' | 'color' | 'icon' | 'imageUrl'> & { questions: KioskQuestion[] };
export type KioskConfig = {
  title: string;
  today: string;
  extendedToday: boolean;
  settings: Pick<Settings, 'autoRead' | 'speechRate' | 'idleSeconds' | 'grades'>;
  topics: KioskTopic[];
};
export type KioskSession = { token: string; expiresInSeconds: number; doneTopicIds: number[] };

// ── Admin ──────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({ password: z.string().min(1).max(200) });
export const DeviceCreate = z.object({ label: z.string().trim().min(1).max(40) });
export const DevicePatch = z.object({ label: z.string().trim().min(1).max(40), revoked: z.boolean() }).partial();
export const CodePatch = z.object({ active: z.boolean(), grade }).partial();

export const BucketSchema = z.enum(['day', 'week', 'month']);
export type Bucket = z.infer<typeof BucketSchema>;

export const ResultsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    grade: z.coerce.number().pipe(grade).optional(),
    bucket: BucketSchema.default('week'),
  })
  .refine((q) => q.from <= q.to, 'from liegt nach to');
export type ResultsQuery = z.infer<typeof ResultsQuerySchema>;

export type Device = { id: number; label: string; createdAt: string; lastSeenAt: string | null; revoked: boolean };
export type ChildCode = CodePicksSchemaType & {
  id: number;
  grade: number;
  deviceLabel: string | null;
  active: boolean;
  createdAt: string;
};
type CodePicksSchemaType = z.infer<typeof CodePicksSchema>;

export type AdminQuestion = Question & { answerCount: number; options: (AnswerOption & { answerCount: number })[] };
export type AdminTopic = Topic & { answerCount: number; questions: AdminQuestion[] };

export type ApiError = { error: string; message: string };

// ── Results ────────────────────────────────────────────────────────────────

export type DistributionEntry = { key: number; label: string; icon: string; count: number };
export type Distribution = { n: number; mean: number | null; entries: DistributionEntry[] };

export type TopicMetrics = { submissions: number; children: number; index: number | null };
export type TopicSummary = TopicMetrics & {
  topicId: number;
  name: string;
  color: string;
  icon: string;
  active: boolean;
  previous: TopicMetrics;
  series: { bucket: string; submissions: number; index: number | null }[];
};
export type ResultsSummary = {
  from: string;
  to: string;
  previous: { from: string; to: string };
  bucket: Bucket;
  grade: number | null;
  totals: { submissions: number; children: number; previous: { submissions: number; children: number } };
  topics: TopicSummary[];
};
export type QuestionResults = Distribution & {
  question: Pick<Question, 'id' | 'topicId' | 'kind' | 'multi' | 'text' | 'icon'>;
  series: ({ bucket: string } & Distribution)[];
};
export type CodesOverview = { codes: ChildCode[]; newPerDay: { day: string; count: number }[] };

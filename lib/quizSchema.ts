import type { QuizChoice, QuizDocument, QuizQuestion, QuizSection, StudyItem } from './quizTypes';

type LooseRecord = Record<string, unknown>;

const choiceIds = ['A', 'B', 'C', 'D'];

function asRecord(value: unknown, label: string): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必須是物件。`);
  }
  return value as LooseRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} 必須是陣列。`);
  return value;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readText(source: LooseRecord, keys: string[]): string {
  for (const key of keys) {
    const value = asText(source[key]);
    if (value) return value;
  }
  return '';
}

function normalizeChoice(raw: unknown, index: number): QuizChoice {
  if (typeof raw === 'string') return { id: choiceIds[index] || String(index + 1), text: raw };
  const source = asRecord(raw, `第 ${index + 1} 個選項`);
  const id = readText(source, ['id', 'key', 'label', 'letter']) || choiceIds[index] || String(index + 1);
  const text = readText(source, ['text', 'value', 'answer', 'content', 'option']);
  if (!text) throw new Error(`選項 ${id} 缺少 text。`);
  return { id, text };
}

function normalizeChoices(value: unknown, questionLabel: string): QuizChoice[] {
  if (Array.isArray(value)) return value.map(normalizeChoice);
  const source = asRecord(value, `${questionLabel} 的 options/choices`);
  return Object.entries(source).map(([id, text]) => ({ id, text: asText(text) })).filter((choice) => choice.text);
}

function normalizeStudyItem(raw: unknown, index: number, sectionTitle: string): StudyItem {
  const source = asRecord(raw, `${sectionTitle} 第 ${index + 1} 個教材`);
  const term = readText(source, ['term', 'idiom', 'word', 'vocabulary', 'title', 'name']);
  const meaning = readText(source, ['meaning', '意思', 'definition', 'explanation']);
  const type = readText(source, ['type']) || 'idiom';
  if (!term) throw new Error(`${sectionTitle} 第 ${index + 1} 個教材缺少 term。`);
  if (!meaning) throw new Error(`${sectionTitle} 的成語「${term}」必須填 meaning。`);
  return {
    id: readText(source, ['id']) || `${sectionTitle.toLowerCase().replace(/\s+/g, '-')}-term-${index + 1}`,
    type: type === 'vocabulary' || type === 'term' ? type : 'idiom',
    term,
    speakText: readText(source, ['speakText', 'speak', 'readText', '朗讀文字']) || term,
    reading: readText(source, ['reading', 'pronunciation', '注音', '讀音']) || undefined,
    meaning,
    detail: readText(source, ['detail', 'note', 'notes', '補充說明']) || undefined,
  };
}

function normalizeQuestion(raw: unknown, index: number, sectionTitle: string): QuizQuestion {
  const source = asRecord(raw, `${sectionTitle} 第 ${index + 1} 題`);
  const prompt = readText(source, ['prompt', 'question', 'title', '題目']);
  if (!prompt) throw new Error(`${sectionTitle} 第 ${index + 1} 題缺少 prompt/question。`);
  const choices = normalizeChoices(source.choices ?? source.options ?? source.選項, `${sectionTitle} 第 ${index + 1} 題`);
  if (choices.length < 2) throw new Error(`${sectionTitle} 第 ${index + 1} 題至少需要兩個選項。`);
  const correctChoiceId = readText(source, ['correctChoiceId', 'correctAnswer', 'answer', '答案']);
  if (!correctChoiceId) throw new Error(`${sectionTitle} 第 ${index + 1} 題缺少 correctChoiceId/correctAnswer。`);
  if (!choices.some((choice) => choice.id === correctChoiceId)) {
    throw new Error(`${sectionTitle} 第 ${index + 1} 題的正確答案「${correctChoiceId}」不在選項中。`);
  }
  return {
    id: readText(source, ['id']) || `${sectionTitle.toLowerCase().replace(/\s+/g, '-')}-q-${index + 1}`,
    type: 'multipleChoice',
    prompt,
    choices,
    correctChoiceId,
    explanation: readText(source, ['explanation', 'detail', '詳解', '解析']) || undefined,
    detail: readText(source, ['supplement', '補充說明']) || undefined,
    relatedItemIds: Array.isArray(source.relatedItemIds) ? (source.relatedItemIds.map(String) as string[]) : undefined,
  };
}

function normalizeSection(raw: unknown, index: number): QuizSection {
  const source = asRecord(raw, `第 ${index + 1} 個 Part`);
  const title = readText(source, ['title', 'name', 'sectionTitle', 'partTitle']) || `STEP ${index + 1}`;
  const studyItemsSource = source.studyItems ?? source.terms ?? source.vocabulary ?? source.idioms ?? source.words ?? source.教材;
  const questionsSource = source.questions ?? source.quizQuestions ?? source.items ?? source.題目;
  return {
    id: readText(source, ['id']) || `step-${index + 1}`,
    title,
    subtitle: readText(source, ['subtitle', 'description', '說明']) || undefined,
    order: typeof source.order === 'number' ? source.order : index + 1,
    studyItems: asArray(studyItemsSource, `${title} 的 studyItems/terms`).map((item, itemIndex) => normalizeStudyItem(item, itemIndex, title)),
    questions: asArray(questionsSource, `${title} 的 questions`).map((question, questionIndex) => normalizeQuestion(question, questionIndex, title)),
  };
}

export function normalizeQuiz(input: unknown): QuizDocument {
  const source = asRecord(input, 'Quiz JSON');
  const title = readText(source, ['title', 'quizTitle', 'name']);
  if (!title) throw new Error('缺少 quiz title。');
  const sectionsSource = source.sections ?? source.parts ?? source.steps ?? source.Part ?? source.段落;
  const sections = asArray(sectionsSource, 'sections/parts').map(normalizeSection);
  if (!sections.length) throw new Error('至少需要一個 Part。');
  return {
    schemaVersion: 'quiz-json-v1',
    title,
    category: readText(source, ['category', 'subject', '分類']) || undefined,
    description: readText(source, ['description', 'summary', '說明']) || undefined,
    locale: readText(source, ['locale', 'lang', 'language']) || 'zh-TW',
    createdBy: readText(source, ['createdBy', 'author']) || undefined,
    sections,
  };
}

export function buildSpeakText(item: StudyItem): string {
  const term = item.speakText || item.term;
  return `${term}，意思：${item.meaning}`;
}

'use client';

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileJson,
  Headphones,
  Home as HomeIcon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultQuizzes } from '../lib/defaultQuizzes';
import { buildSpeakText, normalizeQuiz } from '../lib/quizSchema';
import type { ChoiceId, QuizDocument, QuizProgress, QuizQuestion, QuizRecord, QuizSection, StudyItem } from '../lib/quizTypes';

const STORAGE_KEY = 'quiz-studio.records.v1';
const BACKUP_STORAGE_KEY = 'quiz-studio.records.backup.v1';
const VOICE_KEY = 'quiz-studio.voice-uri.v1';
const DEFAULT_QUIZ_TITLES = new Set(defaultQuizzes.map((quiz) => quiz.title.trim()));

const GPT_QUIZ_PROMPT = `請依照以下規格，幫我把教材整理成 Quiz Studio 可以直接匯入的 JSON。只輸出 JSON，不要加 Markdown 程式碼框，不要加解釋文字。

用途：
這是一個國文成語分段朗讀選擇題網站。每一課可以有多個 Part。每個 Part 先放教材成語，網站只會朗讀成語教材，不朗讀選擇題；之後同一個 Part 一次顯示整組選擇題。

最外層格式：
{
  "schemaVersion": "quiz-json-v1",
  "title": "第幾課 課名：成語分段朗讀選擇題",
  "category": "國文成語",
  "locale": "zh-TW",
  "description": "每個 Part 先讀成語教材，播放按鈕會朗讀「成語，意思：內容」，接著一次完成同一 Part 的選擇題。",
  "createdBy": "ChatGPT",
  "sections": []
}

sections 規則：
1. 每個 Part 放一個 section。
2. section 必須有 id、title、subtitle、order、studyItems、questions。
3. title 格式建議為：STEP 1 與「星」有關的成語。
4. order 用 1、2、3 依序編號。

studyItems 規則：
1. 每個成語或詞語放一筆 studyItem。
2. 必填欄位：id、type、term、speakText、meaning。
3. type 可用 "idiom"、"vocabulary" 或 "term"。
4. term 是畫面上看到的成語。
5. speakText 是播放時朗讀的成語本身，通常和 term 相同。
6. meaning 必填，而且要放意思。朗讀時網站會念：「成語，意思：meaning」。
7. reading 放注音或讀音，例如「熠，音ㄧˋ」。
8. detail 放補充詳解。
9. notes 可放補充筆記陣列。

questions 規則：
1. 每題都是 multipleChoice。
2. 必填欄位：id、type、prompt、choices、correctChoiceId、explanation、relatedItemIds。
3. prompt 是題目敘述。
4. choices 必須是 A、B、C、D 四個選項，每個選項格式為 {"id":"A","text":"選項文字"}。
5. correctChoiceId 填 "A"、"B"、"C" 或 "D"。
6. explanation 寫完整詳解，例如「答案是 B：星光熠熠。因為它形容星光耀眼。」
7. relatedItemIds 必須填這題對應的 studyItem id，答錯時網站會在該成語旁標記不熟悉。

重要限制：
1. id 只能用英文、數字、連字號，例如 star-01、star-q01。
2. JSON 必須合法，不能有註解、不能有多餘逗號。
3. 不要把答案寫在 prompt 裡。
4. 每個 Part 的 questions 要一次列完整，不要分批。
5. 題目選項要打亂，正確答案不要固定都同一個。
6. 如果教材有 STEP 1、STEP 2、STEP 3，就建立三個 sections。
7. 請保留教材中的讀音、意思、補充說明。

請依照這個範例結構輸出：
{
  "schemaVersion": "quiz-json-v1",
  "title": "第一課 夏夜：成語分段朗讀選擇題",
  "category": "國文成語",
  "locale": "zh-TW",
  "description": "每個 Part 先讀成語教材，播放按鈕會朗讀「成語，意思：內容」，接著一次完成同一 Part 的選擇題。",
  "createdBy": "ChatGPT",
  "sections": [
    {
      "id": "step-1-star",
      "title": "STEP 1 與「星」有關的成語",
      "subtitle": "12 個星字相關成語",
      "order": 1,
      "studyItems": [
        {
          "id": "star-01",
          "type": "idiom",
          "term": "星光熠熠",
          "speakText": "星光熠熠",
          "reading": "熠，音ㄧˋ",
          "meaning": "形容星光耀眼。",
          "detail": "熠，光耀、明亮。"
        }
      ],
      "questions": [
        {
          "id": "star-q01",
          "type": "multipleChoice",
          "prompt": "形容星光耀眼。",
          "choices": [
            {"id": "A", "text": "星月交輝"},
            {"id": "B", "text": "星光熠熠"},
            {"id": "C", "text": "月明星稀"},
            {"id": "D", "text": "眾星拱月"}
          ],
          "correctChoiceId": "B",
          "explanation": "答案是 B：星光熠熠。因為它形容星光耀眼。",
          "relatedItemIds": ["star-01"]
        }
      ]
    }
  ]
}

現在請把我接下來提供的教材完整轉成這個 JSON。`;

function createRecord(quiz: QuizDocument): QuizRecord {
  const now = new Date().toISOString();
  const migratedQuiz = migrateQuiz(quiz);
  return {
    id: crypto.randomUUID(),
    quiz: migratedQuiz,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    progress: createInitialProgress(migratedQuiz),
  };
}

function createDefaultRecord(quiz: QuizDocument, index: number): QuizRecord {
  const lessonNumber = lessonOrderValue(quiz.title);
  return {
    ...createRecord(quiz),
    id: `default-lesson-${String(lessonNumber ?? index + 1).padStart(2, '0')}`,
  };
}

function createDefaultRecords(): QuizRecord[] {
  return defaultQuizzes.map((quiz, index) => createDefaultRecord(quiz, index)).sort(compareQuizRecords);
}

function mergeDefaultRecords(records: QuizRecord[]): QuizRecord[] {
  const existingTitles = new Set(records.map((record) => record.quiz.title.trim()));
  const missingDefaults = createDefaultRecords().filter((record) => !existingTitles.has(record.quiz.title.trim()));
  return [...records, ...missingDefaults].sort(compareQuizRecords);
}

function createInitialProgress(quiz: QuizDocument): QuizProgress {
  return {
    lastSectionId: quiz.sections[0]?.id,
    answers: {},
    checkedSections: {},
    questionOrderBySection: Object.fromEntries(quiz.sections.map((section) => [section.id, section.questions.map((question) => question.id)])),
  };
}

function migrateQuiz(quiz: QuizDocument): QuizDocument {
  return {
    ...quiz,
    description: quiz.description?.replace('播放按鈕只朗讀成語本身', '播放按鈕會朗讀「成語，意思：內容」'),
    sections: quiz.sections.map((section) => ({
      ...section,
      studyItems: section.studyItems.map((item) => ({
        ...item,
        meaning: item.meaning || item.explanation || '',
      })),
    })),
  };
}

function normalizeRecord(record: QuizRecord): QuizRecord {
  const quiz = migrateQuiz(record.quiz);
  return {
    ...record,
    quiz,
    progress: migrateProgress(record.progress, quiz),
  };
}

function migrateProgress(progress: QuizProgress | undefined, quiz: QuizDocument): QuizProgress {
  const answers = progress && typeof progress.answers === 'object' && progress.answers ? progress.answers : {};
  const checkedSections = progress && typeof progress.checkedSections === 'object' && progress.checkedSections ? progress.checkedSections : {};
  const existingOrder = progress?.questionOrderBySection || {};
  const questionOrderBySection = Object.fromEntries(
    quiz.sections.map((section) => {
      const validIds = new Set(section.questions.map((question) => question.id));
      const saved = Array.isArray(existingOrder[section.id]) ? existingOrder[section.id].filter((id) => validIds.has(id)) : [];
      const missing = section.questions.map((question) => question.id).filter((id) => !saved.includes(id));
      return [section.id, [...saved, ...missing]];
    }),
  );
  return {
    lastSectionId: progress?.lastSectionId || quiz.sections[0]?.id,
    answers,
    checkedSections,
    questionOrderBySection,
  };
}

function backupLocalPayload(payload: string, reason: string) {
  try {
    const existing = window.localStorage.getItem(BACKUP_STORAGE_KEY);
    const backups = existing ? JSON.parse(existing) : [];
    const nextBackups = Array.isArray(backups) ? backups : [];
    nextBackups.unshift({ savedAt: new Date().toISOString(), reason, payload });
    window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(nextBackups.slice(0, 5)));
  } catch {
    window.localStorage.setItem(`${BACKUP_STORAGE_KEY}.${Date.now()}`, payload);
  }
}

function loadLocalRecords(): QuizRecord[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initial = createDefaultRecords();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(saved) as QuizRecord[];
    if (!Array.isArray(parsed) || !parsed.length) {
      const initial = createDefaultRecords();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    backupLocalPayload(saved, 'before-progress-migration');
    const migrated = parsed.map(normalizeRecord);
    const withDefaults = mergeDefaultRecords(migrated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withDefaults));
    return withDefaults;
  } catch {
    backupLocalPayload(saved, 'unreadable-records');
    return createDefaultRecords();
  }
}

const questionCount = (quiz: QuizDocument) => quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
const answeredCount = (record: QuizRecord) => Object.keys(record.progress.answers || {}).length;
const saveLocal = (records: QuizRecord[]) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
const formatTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : '尚未記錄';
const sectionScore = (section: QuizSection, progress: QuizProgress) =>
  section.questions.reduce((score, question) => score + (progress.answers[question.id] === question.correctChoiceId ? 1 : 0), 0);

function parseChineseLessonNumber(value: string): number | null {
  const digitMap: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (!/^[零〇一二兩三四五六七八九十百]+$/.test(normalized)) return null;
  const hundredParts = normalized.split('百');
  let total = 0;
  let rest = normalized;
  if (hundredParts.length > 1) {
    total += (hundredParts[0] ? digitMap[hundredParts[0]] : 1) * 100;
    rest = hundredParts.slice(1).join('百');
  }
  if (rest.includes('十')) {
    const [tens, ones] = rest.split('十');
    total += (tens ? digitMap[tens] : 1) * 10;
    total += ones ? digitMap[ones] : 0;
    return Number.isFinite(total) ? total : null;
  }
  const digits = [...rest].map((char) => digitMap[char]);
  if (digits.some((digit) => digit === undefined)) return null;
  return total + digits.reduce((sum, digit) => sum * 10 + digit, 0);
}

function lessonOrderValue(title: string): number | null {
  const match = title.match(/第\s*([0-9]+|[零〇一二兩三四五六七八九十百]+)\s*課/);
  return match ? parseChineseLessonNumber(match[1]) : null;
}

function compareQuizRecords(a: QuizRecord, b: QuizRecord) {
  const lessonA = lessonOrderValue(a.quiz.title);
  const lessonB = lessonOrderValue(b.quiz.title);
  if (lessonA !== null && lessonB !== null && lessonA !== lessonB) return lessonA - lessonB;
  if (lessonA !== null && lessonB === null) return -1;
  if (lessonA === null && lessonB !== null) return 1;
  return a.quiz.title.localeCompare(b.quiz.title, 'zh-Hant');
}

function isDefaultQuizRecord(record: QuizRecord) {
  return record.id.startsWith('default-lesson-') || DEFAULT_QUIZ_TITLES.has(record.quiz.title.trim());
}

function sortedChineseVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const zhVoices = voices.filter((voice) => /zh|Chinese|Mandarin|Taiwan|Hong Kong|China|Mei-Jia|Ting-Ting|Sin-ji/i.test(`${voice.lang} ${voice.name}`));
  return zhVoices.sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name, 'zh-Hant'));
}

function voiceRank(voice: SpeechSynthesisVoice) {
  const label = `${voice.lang} ${voice.name}`.toLowerCase();
  if (label.includes('zh-tw') || label.includes('taiwan') || label.includes('mei-jia')) return 0;
  if (label.includes('zh-hk') || label.includes('hong kong') || label.includes('sin-ji')) return 1;
  if (label.includes('zh-cn') || label.includes('china') || label.includes('ting-ting')) return 2;
  if (label.includes('zh')) return 3;
  return 4;
}

function voiceLabel(voice: SpeechSynthesisVoice) {
  const region = voice.lang === 'zh-TW' ? '台灣國語' : voice.lang === 'zh-HK' ? '香港中文' : voice.lang === 'zh-CN' ? '普通話' : voice.lang;
  return `${voice.name} · ${region}`;
}

function pickSpeechVoice(voices: SpeechSynthesisVoice[], selectedVoiceURI: string, failedVoiceURIs: Set<string>) {
  if (!selectedVoiceURI) return undefined;
  const selected = voices.find((voice) => voice.voiceURI === selectedVoiceURI);
  if (!selected || failedVoiceURIs.has(selected.voiceURI)) return undefined;
  return selected;
}

function createSpeechUtterance(text: string, locale: string, voice?: SpeechSynthesisVoice) {
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || locale || 'zh-TW';
  utterance.rate = 0.82;
  utterance.pitch = 1;
  utterance.volume = 1;
  return utterance;
}

function orderedQuestions(section: QuizSection, progress: QuizProgress): QuizQuestion[] {
  const byId = new Map(section.questions.map((question) => [question.id, question]));
  const savedOrder = progress.questionOrderBySection?.[section.id] || [];
  const ordered = savedOrder.map((id) => byId.get(id)).filter(Boolean) as QuizQuestion[];
  const missing = section.questions.filter((question) => !savedOrder.includes(question.id));
  return [...ordered, ...missing];
}

function shuffledQuestionIds(section: QuizSection, previousOrder: string[] = []): string[] {
  const ids = section.questions.map((question) => question.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  if (ids.length > 1 && previousOrder.length === ids.length && ids.every((id, index) => id === previousOrder[index])) {
    ids.push(ids.shift()!);
  }
  return ids;
}

function relatedItemIdsForQuestion(question: QuizQuestion, section: QuizSection): string[] {
  if (question.relatedItemIds?.length) return question.relatedItemIds;
  const correctText = question.choices.find((choice) => choice.id === question.correctChoiceId)?.text;
  if (!correctText) return [];
  return section.studyItems
    .filter((item) => item.term === correctText || item.speakText === correctText)
    .map((item) => item.id);
}

function wrongQuestionCount(section: QuizSection, progress: QuizProgress) {
  if (!progress.checkedSections?.[section.id]) return 0;
  return section.questions.filter((question) => progress.answers[question.id] !== question.correctChoiceId).length;
}

function unfamiliarItemCounts(section: QuizSection, progress: QuizProgress): Record<string, number> {
  if (!progress.checkedSections?.[section.id]) return {};
  return section.questions
    .filter((question) => progress.answers[question.id] !== question.correctChoiceId)
    .flatMap((question) => relatedItemIdsForQuestion(question, section))
    .reduce<Record<string, number>>((counts, itemId) => {
      counts[itemId] = (counts[itemId] || 0) + 1;
      return counts;
    }, {});
}

export default function Home() {
  const [records, setRecords] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [mode, setMode] = useState<'study' | 'quiz'>('study');
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [toast, setToast] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => (typeof window === 'undefined' ? '' : window.localStorage.getItem(VOICE_KEY) || ''));
  const failedVoiceURIsRef = useRef<Set<string>>(new Set());
  const speechTimerRef = useRef<number | null>(null);
  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

  useEffect(() => {
    queueMicrotask(() => {
      setRecords(loadLocalRecords());
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const updateVoices = () => setVoices(sortedChineseVoices(window.speechSynthesis.getVoices()));
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);

  const filteredRecords = useMemo(() => {
    const text = search.trim().toLowerCase();
    return records
      .filter((record) => {
        if (!text) return true;
        return [record.quiz.title, record.quiz.category, record.quiz.description, ...record.quiz.sections.map((section) => section.title)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text);
      })
      .sort(compareQuizRecords);
  }, [records, search]);

  async function persistRecord(nextRecord: QuizRecord) {
    const nextRecords = records.map((record) => (record.id === nextRecord.id ? nextRecord : record));
    setRecords(nextRecords);
    saveLocal(nextRecords);
  }

  async function addQuiz(quiz: QuizDocument) {
    const record = createRecord(quiz);
    const nextRecords = [...records, record].sort(compareQuizRecords);
    setRecords(nextRecords);
    saveLocal(nextRecords);
    setSelectedId(record.id);
    setSectionIndex(0);
    setMode('study');
    setToast('Quiz 已建立');
  }

  async function deleteQuiz(recordId: string) {
    const target = records.find((record) => record.id === recordId);
    if (target && isDefaultQuizRecord(target)) {
      setToast('Main 預設題庫不能刪除');
      return;
    }
    const nextRecords = records.filter((record) => record.id !== recordId);
    setRecords(nextRecords);
    if (selectedId === recordId) setSelectedId(null);
    saveLocal(nextRecords);
  }

  async function openQuiz(record: QuizRecord) {
    const lastIndex = Math.max(0, record.quiz.sections.findIndex((section) => section.id === record.progress.lastSectionId));
    setSelectedId(record.id);
    setSectionIndex(lastIndex);
    setMode('study');
    await persistRecord({ ...record, lastOpenedAt: new Date().toISOString() });
  }

  async function submitImport() {
    setImportError('');
    try {
      await addQuiz(normalizeQuiz(JSON.parse(importText)));
      setShowImport(false);
      setImportText('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'JSON 格式不正確。');
    }
  }

  function speak(item: StudyItem, locale = 'zh-TW') {
    const synth = window.speechSynthesis;
    if (!synth) {
      setToast('這個瀏覽器不支援朗讀');
      return;
    }
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    const currentVoices = sortedChineseVoices(synth.getVoices());
    if (currentVoices.length) setVoices(currentVoices);
    const text = buildSpeakText(item);
    const voicePool = currentVoices.length ? currentVoices : voices;
    const preferredVoice = pickSpeechVoice(voicePool, selectedVoiceURI, failedVoiceURIsRef.current);

    const markVoiceFailed = (voice: SpeechSynthesisVoice) => {
      failedVoiceURIsRef.current.add(voice.voiceURI);
      setSelectedVoiceURI('');
      window.localStorage.removeItem(VOICE_KEY);
      synth.cancel();
      synth.resume();
      setToast('這個語音不能用，已切回預設語音');
    };

    const utterance = createSpeechUtterance(text, locale, preferredVoice);
    utterance.onstart = () => {
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    };
    utterance.onend = () => {
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    };
    utterance.onerror = () => {
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
      if (preferredVoice) {
        markVoiceFailed(preferredVoice);
        return;
      }
      synth.cancel();
      synth.resume();
      setToast('朗讀失敗，請確認裝置不是靜音模式');
    };

    synth.cancel();
    synth.resume();
    synth.speak(utterance);

    if (preferredVoice) {
      speechTimerRef.current = window.setTimeout(() => {
        if (!synth.speaking) markVoiceFailed(preferredVoice);
      }, 1800);
    }
  }

  function chooseVoice(voiceURI: string) {
    const synth = window.speechSynthesis;
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    if (synth) {
      synth.cancel();
      synth.resume();
    }
    if (voiceURI) failedVoiceURIsRef.current.delete(voiceURI);
    setSelectedVoiceURI(voiceURI);
    if (voiceURI) {
      window.localStorage.setItem(VOICE_KEY, voiceURI);
    } else {
      window.localStorage.removeItem(VOICE_KEY);
    }
  }

  async function chooseAnswer(questionId: string, choiceId: ChoiceId) {
    if (!selectedRecord) return;
    const questionSection = selectedRecord.quiz.sections.find((section) => section.questions.some((question) => question.id === questionId));
    if (questionSection && selectedRecord.progress.checkedSections?.[questionSection.id]) return;
    await persistRecord({
      ...selectedRecord,
      progress: { ...selectedRecord.progress, answers: { ...selectedRecord.progress.answers, [questionId]: choiceId } },
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });
  }

  async function checkSection() {
    if (!selectedRecord) return;
    const section = selectedRecord.quiz.sections[sectionIndex];
    await persistRecord({
      ...selectedRecord,
      progress: {
        ...selectedRecord.progress,
        lastSectionId: section.id,
        checkedSections: { ...selectedRecord.progress.checkedSections, [section.id]: true },
      },
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });
  }

  async function resetSection() {
    if (!selectedRecord) return;
    const section = selectedRecord.quiz.sections[sectionIndex];
    const answers = { ...selectedRecord.progress.answers };
    section.questions.forEach((question) => delete answers[question.id]);
    const checkedSections = { ...selectedRecord.progress.checkedSections };
    delete checkedSections[section.id];
    const previousOrder = selectedRecord.progress.questionOrderBySection?.[section.id];
    await persistRecord({
      ...selectedRecord,
      progress: {
        ...selectedRecord.progress,
        answers,
        checkedSections,
        questionOrderBySection: {
          ...selectedRecord.progress.questionOrderBySection,
          [section.id]: shuffledQuestionIds(section, previousOrder),
        },
      },
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });
    setMode('quiz');
  }

  async function moveSection(nextIndex: number) {
    if (!selectedRecord) return;
    const section = selectedRecord.quiz.sections[nextIndex];
    setSectionIndex(nextIndex);
    setMode('study');
    await persistRecord({ ...selectedRecord, progress: { ...selectedRecord.progress, lastSectionId: section.id }, updatedAt: new Date().toISOString() });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f6f3] text-zinc-950">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="glass-panel w-full max-w-md p-8 text-center">
            <Sparkles className="mx-auto mb-4 h-8 w-8" />
            <p className="text-sm text-zinc-500">正在準備你的 Quiz 空間</p>
          </div>
        </div>
      </main>
    );
  }

  if (selectedRecord) {
    return (
      <QuizPlayer
        record={selectedRecord}
        sectionIndex={sectionIndex}
        mode={mode}
        onBack={() => setSelectedId(null)}
        onMode={setMode}
        onSpeak={speak}
        onAnswer={chooseAnswer}
        onCheck={checkSection}
        onResetSection={resetSection}
        onMoveSection={moveSection}
        voices={voices}
        selectedVoiceURI={selectedVoiceURI}
        onVoice={chooseVoice}
      />
    );
  }

  const totalQuestions = records.reduce((sum, record) => sum + questionCount(record.quiz), 0);
  const totalAnswered = records.reduce((sum, record) => sum + answeredCount(record), 0);
  const mainRecords = filteredRecords.filter(isDefaultQuizRecord);
  const myRecords = filteredRecords.filter((record) => !isDefaultQuizRecord(record));

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f6f3] text-zinc-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-180px] h-[460px] w-[740px] -translate-x-1/2 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-[-220px] right-[-120px] h-[480px] w-[480px] rounded-full bg-zinc-200/70 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button className="brand-mark" type="button" aria-label="Quiz Studio">
            <BookOpen className="h-5 w-5" />
            <span>Quiz Studio</span>
          </button>
        </header>

        <section className="hero-shell mb-7">
          <div className="max-w-3xl">
            <p className="eyebrow">成語朗讀與選擇題製作器</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
              貼上 JSON，一次建立完整分段 Quiz。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
              每份 Quiz 可以分 Part 先讀教材，再一次顯示整組選擇題。播放鍵會朗讀「成語，意思：內容」，作答進度會保存。
            </p>
          </div>
          <button className="primary-cta" type="button" onClick={() => setShowImport(true)}>
            <Plus className="h-5 w-5" />新增 Quiz
          </button>
        </section>

        <section className="mb-6 grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <label className="search-box">
            <Search className="h-5 w-5 text-zinc-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋標題、分類或 Part" />
          </label>
          <MetricCard label="Main / My Quiz" value={`${records.filter(isDefaultQuizRecord).length} / ${records.filter((record) => !isDefaultQuizRecord(record)).length}`} />
          <MetricCard label="已作答 / 題目" value={`${totalAnswered} / ${totalQuestions}`} />
        </section>

        <QuizShelf
          title="Main"
          description="預設課程會一直保留，不能刪除。"
          records={mainRecords}
          onOpen={openQuiz}
          onDelete={deleteQuiz}
          locked
        />

        <QuizShelf
          title="My Quiz"
          description="你新增的 JSON Quiz 會放在這裡。"
          records={myRecords}
          onOpen={openQuiz}
          onDelete={deleteQuiz}
          emptyText={search.trim() ? 'My Quiz 沒有符合搜尋的題庫。' : '還沒有自己新增的 Quiz。'}
        />

        {filteredRecords.length === 0 && (
          <section className="glass-panel mx-auto mt-8 max-w-lg p-8 text-center">
            <FileJson className="mx-auto mb-4 h-8 w-8 text-zinc-500" />
            <h2 className="text-xl font-semibold">找不到 Quiz</h2>
            <p className="mt-2 text-sm text-zinc-500">換個關鍵字，或新增一份 JSON Quiz。</p>
          </section>
        )}
      </div>

      {showImport && (
        <ImportModal
          value={importText}
          error={importError}
          onChange={setImportText}
          onClose={() => {
            setShowImport(false);
            setImportError('');
          }}
          onUsePrompt={() => {
            setImportText(GPT_QUIZ_PROMPT);
            setToast('GPT 指令已放入文字框');
          }}
          onSubmit={submitImport}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuizShelf({
  title,
  description,
  records,
  onOpen,
  onDelete,
  locked = false,
  emptyText,
}: {
  title: string;
  description: string;
  records: QuizRecord[];
  onOpen: (record: QuizRecord) => void;
  onDelete: (recordId: string) => void;
  locked?: boolean;
  emptyText?: string;
}) {
  if (!records.length) {
    return (
      <section className="quiz-shelf">
        <div className="shelf-heading">
          <div>
            <p className="eyebrow">{title}</p>
            <h2>{title}</h2>
            <span>{description}</span>
          </div>
          <strong>0</strong>
        </div>
        {emptyText && <div className="empty-shelf">{emptyText}</div>}
      </section>
    );
  }

  return (
    <section className="quiz-shelf">
      <div className="shelf-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
        <strong>{records.length}</strong>
      </div>
      <div className="quiz-grid">
        {records.map((record) => (
          <QuizCard
            key={record.id}
            record={record}
            locked={locked}
            onOpen={() => onOpen(record)}
            onDelete={() => onDelete(record.id)}
          />
        ))}
      </div>
    </section>
  );
}

function QuizCard({ record, onOpen, onDelete, locked = false }: { record: QuizRecord; onOpen: () => void; onDelete: () => void; locked?: boolean }) {
  const total = questionCount(record.quiz);
  const terms = record.quiz.sections.reduce((sum, section) => sum + section.studyItems.length, 0);
  const progress = total ? Math.round((answeredCount(record) / total) * 100) : 0;
  return (
    <article className="quiz-card group">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <span className="category-pill">{record.quiz.category || '未分類'}</span>
          <h2 className="mt-4 line-clamp-2 text-2xl font-semibold tracking-normal">{record.quiz.title}</h2>
        </div>
        {locked ? (
          <span className="locked-pill">Main</span>
        ) : (
          <button className="icon-button danger" type="button" aria-label="刪除 Quiz" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="line-clamp-2 min-h-12 text-sm leading-6 text-zinc-500">{record.quiz.description || '這份 Quiz 尚未加入描述。'}</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        <PreviewStat label="Part" value={record.quiz.sections.length} />
        <PreviewStat label="成語" value={terms} />
        <PreviewStat label="題目" value={total} />
      </div>
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>進度</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-200">
          <div className="h-full rounded-full bg-zinc-950 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock3 className="h-3.5 w-3.5" />{formatTime(record.lastOpenedAt || record.updatedAt)}
        </span>
        <button className="open-button" type="button" onClick={onOpen}>
          開始<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="preview-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function QuizPlayer({
  record,
  sectionIndex,
  mode,
  onBack,
  onMode,
  onSpeak,
  onAnswer,
  onCheck,
  onResetSection,
  onMoveSection,
  voices,
  selectedVoiceURI,
  onVoice,
}: {
  record: QuizRecord;
  sectionIndex: number;
  mode: 'study' | 'quiz';
  onBack: () => void;
  onMode: (mode: 'study' | 'quiz') => void;
  onSpeak: (item: StudyItem, locale?: string) => void;
  onAnswer: (questionId: string, choiceId: ChoiceId) => void;
  onCheck: () => void;
  onResetSection: () => void;
  onMoveSection: (index: number) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  onVoice: (voiceURI: string) => void;
}) {
  const section = record.quiz.sections[sectionIndex];
  const checked = Boolean(record.progress.checkedSections?.[section.id]);
  const answered = section.questions.filter((question) => record.progress.answers[question.id]).length;
  const score = sectionScore(section, record.progress);
  const wrong = wrongQuestionCount(section, record.progress);
  const unfamiliarCounts = unfamiliarItemCounts(section, record.progress);
  const questions = orderedQuestions(section, record.progress);
  const allAnswered = answered === section.questions.length;
  const total = questionCount(record.quiz);
  const totalDone = answeredCount(record);
  const voiceSelectValue = voices.some((voice) => voice.voiceURI === selectedVoiceURI) ? selectedVoiceURI : '';

  return (
    <main className="min-h-screen bg-[#f6f6f3] text-zinc-950">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="player-sidebar">
          <button className="quiet-button mb-6 w-fit" type="button" onClick={onBack}>
            <HomeIcon className="h-4 w-4" />主畫面
          </button>
          <p className="eyebrow">目前 Quiz</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">{record.quiz.title}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">{record.quiz.description}</p>
          <div className="mt-6 rounded-2xl bg-zinc-950 p-4 text-white">
            <div className="mb-2 flex justify-between text-xs text-zinc-400">
              <span>總進度</span>
              <span>{totalDone} / {total}</span>
            </div>
            <div className="h-2 rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${total ? (totalDone / total) * 100 : 0}%` }} />
            </div>
          </div>
          <nav className="mt-5 space-y-2">
            {record.quiz.sections.map((item, index) => (
              <button key={item.id} className={`section-tab ${index === sectionIndex ? 'active' : ''}`} type="button" onClick={() => onMoveSection(index)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.title.replace(/^STEP \d+\s*/, '')}</strong>
              </button>
            ))}
          </nav>
        </aside>

        <section className="player-main">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">{record.quiz.category || 'Quiz'}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal sm:text-5xl">{section.title}</h2>
              {section.subtitle && <p className="mt-3 text-zinc-500">{section.subtitle}</p>}
            </div>
            <div className="segmented">
              <button type="button" className={mode === 'study' ? 'active' : ''} onClick={() => onMode('study')}>教材</button>
              <button type="button" className={mode === 'quiz' ? 'active' : ''} onClick={() => onMode('quiz')}>選擇題</button>
            </div>
          </div>

          {mode === 'study' ? (
            <div className="space-y-4">
              <div className="glass-panel p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">先看教材，朗讀成語與意思</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      本 Part 共 {section.questions.length} 題，錯 {wrong} 題。每個播放鍵會念「成語，意思：內容」，不會朗讀選擇題。
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <label className="voice-picker">
                      <Headphones className="h-4 w-4" />
                      <select value={voiceSelectValue} onChange={(event) => onVoice(event.target.value)} aria-label="朗讀語音">
                        <option value="">預設語音（最穩）</option>
                        {voices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voiceLabel(voice)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="dark-button" type="button" onClick={() => onMode('quiz')}>開始本 Part 題目<ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
              <div className="term-grid">
                {section.studyItems.map((item, index) => (
                  <article className={`term-card ${unfamiliarCounts[item.id] ? 'unfamiliar' : ''}`} key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="term-index">{String(index + 1).padStart(2, '0')}</span>
                        {unfamiliarCounts[item.id] && <span className="unfamiliar-pill">不熟悉 · 錯 {unfamiliarCounts[item.id]} 題</span>}
                      </div>
                      <button className="icon-button" type="button" aria-label={`朗讀 ${item.term}`} onClick={() => onSpeak(item, record.quiz.locale)}>
                        <Headphones className="h-4 w-4" />
                      </button>
                    </div>
                    <h3 className="mt-5 text-3xl font-semibold tracking-normal">{item.term}</h3>
                    {item.reading && <p className="mt-2 text-sm font-medium text-zinc-500">{item.reading}</p>}
                    <p className="mt-4 text-sm leading-6 text-zinc-700">{item.meaning || item.explanation}</p>
                    {item.detail && <p className="mt-2 text-sm leading-6 text-zinc-500">{item.detail}</p>}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-panel p-5 sm:p-6">
                <div>
                  <h3 className="text-xl font-semibold">一次完成本 Part 的所有題目</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    已選 {answered} / {section.questions.length}
                    {checked ? `，本次答對 ${score} 題，錯 ${wrong} 題。批改後答案已固定，按重做才可重新作答。` : ''}
                  </p>
                </div>
              </div>

              {questions.map((question, index) => {
                const selected = record.progress.answers[question.id];
                const isCorrect = selected === question.correctChoiceId;
                return (
                  <article className="question-card" key={question.id}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <span className="question-number">第 {index + 1} 題</span>
                        <h3 className="mt-2 text-xl font-semibold tracking-normal">{question.prompt}</h3>
                      </div>
                      {checked && <span className={`result-badge ${isCorrect ? 'correct' : 'wrong'}`}>{isCorrect ? '答對' : '再練習'}</span>}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {question.choices.map((choice) => {
                        const choiceSelected = selected === choice.id;
                        const isAnswer = checked && choice.id === question.correctChoiceId;
                        const isWrongPick = checked && choiceSelected && choice.id !== question.correctChoiceId;
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            className={`choice-button ${choiceSelected ? 'selected' : ''} ${isAnswer ? 'answer' : ''} ${isWrongPick ? 'wrong' : ''}`}
                            disabled={checked}
                            onClick={() => onAnswer(question.id, choice.id)}
                          >
                            <span>{choice.id}</span>
                            <strong>{choice.text}</strong>
                          </button>
                        );
                      })}
                    </div>
                    {checked && <p className="mt-4 rounded-2xl bg-zinc-100 p-4 text-sm leading-6 text-zinc-600">{question.explanation || `正確答案是 ${question.correctChoiceId}。`}</p>}
                  </article>
                );
              })}

              <div className="flex flex-col gap-3 py-4 sm:flex-row sm:justify-between">
                <button className="quiet-button" type="button" disabled={sectionIndex === 0} onClick={() => onMoveSection(sectionIndex - 1)}>
                  <ChevronLeft className="h-4 w-4" />上一 Part
                </button>
                <button className="dark-button" type="button" disabled={sectionIndex >= record.quiz.sections.length - 1} onClick={() => onMoveSection(sectionIndex + 1)}>
                  下一 Part<ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="quiz-bottom-actions">
                <div>
                  <span>{checked ? `本次答對 ${score} 題，錯 ${wrong} 題` : `已選 ${answered} / ${section.questions.length}`}</span>
                  <strong>{checked ? '答案已固定，重做才可重新作答。' : '全部選完後再批改。'}</strong>
                </div>
                <div className="quiz-bottom-buttons">
                  <button className="quiet-button" type="button" onClick={onResetSection}><RefreshCw className="h-4 w-4" />重做</button>
                  <button className="dark-button" type="button" disabled={!allAnswered || checked} onClick={onCheck}><Check className="h-4 w-4" />批改</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ImportModal({
  value,
  error,
  onChange,
  onClose,
  onUsePrompt,
  onSubmit,
}: {
  value: string;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onUsePrompt: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="新增 Quiz">
      <section className="modal-card">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">新增 Quiz</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">貼上固定 JSON</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">先用 GPT 指令產生 JSON，再貼回這裡建立 Quiz。成語必須填 meaning，朗讀時會一起念意思。</p>
          </div>
          <button className="icon-button" type="button" aria-label="關閉" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="schema-strip">
          <span>title</span><span>sections / parts</span><span>studyItems / terms</span><span>term / idiom</span><span>meaning</span><span>questions</span><span>choices / options</span><span>correctChoiceId / correctAnswer</span>
        </div>
        <textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} placeholder="把 ChatGPT 產生的 quiz-json-v1 貼在這裡" />
        {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button className="quiet-button" type="button" onClick={onUsePrompt}><Sparkles className="h-4 w-4" />GPT 指令</button>
          <button className="dark-button" type="button" onClick={onSubmit}><Plus className="h-4 w-4" />建立 Quiz</button>
        </div>
      </section>
    </div>
  );
}

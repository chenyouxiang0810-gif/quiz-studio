'use client';

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  FileJson,
  Headphones,
  Home as HomeIcon,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSpeakText, normalizeQuiz } from '../lib/quizSchema';
import { sampleQuiz } from '../lib/sampleQuiz';
import type { ChoiceId, QuizDocument, QuizProgress, QuizRecord, QuizSection, StudyItem } from '../lib/quizTypes';

type FirebaseBundle = { app: FirebaseApp; db: Firestore; auth: ReturnType<typeof getAuth> };

const STORAGE_KEY = 'quiz-studio.records.v1';
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
let firebaseBundle: FirebaseBundle | null = null;

function getFirebase(): FirebaseBundle | null {
  if (!firebaseReady) return null;
  if (firebaseBundle) return firebaseBundle;
  const app = initializeApp(firebaseConfig);
  firebaseBundle = { app, auth: getAuth(app), db: getFirestore(app) };
  return firebaseBundle;
}

function createRecord(quiz: QuizDocument): QuizRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    quiz: migrateQuiz(quiz),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    progress: { lastSectionId: quiz.sections[0]?.id, answers: {}, checkedSections: {} },
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

function loadLocalRecords(): QuizRecord[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initial = [createRecord(sampleQuiz)];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(saved) as QuizRecord[];
    if (!Array.isArray(parsed) || !parsed.length) return [createRecord(sampleQuiz)];
    const migrated = parsed.map((record) => ({ ...record, quiz: migrateQuiz(record.quiz) }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [createRecord(sampleQuiz)];
  }
}

function normalizeDate(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return new Date().toISOString();
}

const questionCount = (quiz: QuizDocument) => quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
const studyCount = (quiz: QuizDocument) => quiz.sections.reduce((sum, section) => sum + section.studyItems.length, 0);
const answeredCount = (record: QuizRecord) => Object.keys(record.progress.answers || {}).length;
const saveLocal = (records: QuizRecord[]) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
const formatTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : '尚未記錄';
const sectionScore = (section: QuizSection, progress: QuizProgress) =>
  section.questions.reduce((score, question) => score + (progress.answers[question.id] === question.correctChoiceId ? 1 : 0), 0);

export default function Home() {
  const [records, setRecords] = useState<QuizRecord[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [mode, setMode] = useState<'study' | 'quiz'>('study');
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [toast, setToast] = useState('');
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const firebase = useMemo(() => getFirebase(), []);
  const cloudMode = Boolean(firebase && user);
  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

  useEffect(() => {
    if (!firebase) {
      queueMicrotask(() => {
        setRecords(loadLocalRecords());
        setLoading(false);
      });
      return;
    }
    return onAuthStateChanged(firebase.auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, [firebase]);

  useEffect(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (!firebase || !user) return;
    const q = query(collection(firebase.db, 'users', user.uid, 'quizzes'), orderBy('updatedAt', 'desc'));
    unsubscribeRef.current = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        const record = { ...createRecord(sampleQuiz), id: 'demo-idiom-quiz' };
        await setDoc(doc(firebase.db, 'users', user.uid, 'quizzes', record.id), {
          ...record,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastOpenedAt: serverTimestamp(),
        });
        return;
      }
      setRecords(snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          quiz: migrateQuiz(data.quiz as QuizDocument),
          createdAt: normalizeDate(data.createdAt),
          updatedAt: normalizeDate(data.updatedAt),
          lastOpenedAt: normalizeDate(data.lastOpenedAt),
          progress: (data.progress as QuizProgress) ?? { answers: {}, checkedSections: {} },
        };
      }));
      setLoading(false);
    }, () => setLoading(false));
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [firebase, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      .sort((a, b) => new Date(b.lastOpenedAt || b.updatedAt).getTime() - new Date(a.lastOpenedAt || a.updatedAt).getTime());
  }, [records, search]);

  async function persistRecord(nextRecord: QuizRecord) {
    const nextRecords = records.map((record) => (record.id === nextRecord.id ? nextRecord : record));
    setRecords(nextRecords);
    if (cloudMode && firebase && user) {
      await updateDoc(doc(firebase.db, 'users', user.uid, 'quizzes', nextRecord.id), {
        progress: nextRecord.progress,
        updatedAt: serverTimestamp(),
        lastOpenedAt: serverTimestamp(),
      });
    } else {
      saveLocal(nextRecords);
    }
  }

  async function addQuiz(quiz: QuizDocument) {
    const record = createRecord(quiz);
    if (cloudMode && firebase && user) {
      await setDoc(doc(firebase.db, 'users', user.uid, 'quizzes', record.id), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastOpenedAt: serverTimestamp(),
      });
    } else {
      const nextRecords = [record, ...records];
      setRecords(nextRecords);
      saveLocal(nextRecords);
    }
    setSelectedId(record.id);
    setSectionIndex(0);
    setMode('study');
    setToast('Quiz 已建立');
  }

  async function deleteQuiz(recordId: string) {
    const nextRecords = records.filter((record) => record.id !== recordId);
    setRecords(nextRecords);
    if (selectedId === recordId) setSelectedId(null);
    if (cloudMode && firebase && user) await deleteDoc(doc(firebase.db, 'users', user.uid, 'quizzes', recordId));
    else saveLocal(nextRecords);
  }

  async function openQuiz(record: QuizRecord) {
    const lastIndex = Math.max(0, record.quiz.sections.findIndex((section) => section.id === record.progress.lastSectionId));
    setSelectedId(record.id);
    setSectionIndex(lastIndex);
    setMode('study');
    await persistRecord({ ...record, lastOpenedAt: new Date().toISOString() });
  }

  async function signIn() {
    if (!firebase) {
      setToast('請先填入 Firebase 設定，才會啟用 Google 登入');
      return;
    }
    await signInWithPopup(firebase.auth, new GoogleAuthProvider());
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
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildSpeakText(item));
    utterance.lang = locale;
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  async function chooseAnswer(questionId: string, choiceId: ChoiceId) {
    if (!selectedRecord) return;
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
    await persistRecord({ ...selectedRecord, progress: { ...selectedRecord.progress, answers, checkedSections }, updatedAt: new Date().toISOString() });
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
      />
    );
  }

  const totalQuestions = records.reduce((sum, record) => sum + questionCount(record.quiz), 0);
  const totalAnswered = records.reduce((sum, record) => sum + answeredCount(record), 0);

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">
              <Cloud className="h-4 w-4" />
              {cloudMode ? 'Google 雲端同步' : firebaseReady ? '等待 Google 登入' : '本機 Demo 模式'}
            </span>
            {firebaseReady && user ? (
              <button className="quiet-button" type="button" onClick={() => signOut(firebase!.auth)}>
                <LogOut className="h-4 w-4" />登出
              </button>
            ) : (
              <button className={firebaseReady ? 'dark-button' : 'quiet-button'} type="button" onClick={signIn}>
                <LogIn className="h-4 w-4" />{firebaseReady ? '使用 Google 登入' : '啟用登入'}
              </button>
            )}
          </div>
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
          <MetricCard label="Quiz" value={records.length} />
          <MetricCard label="已作答 / 題目" value={`${totalAnswered} / ${totalQuestions}`} />
        </section>

        {!firebaseReady && (
          <section className="setup-note mb-6">
            <Cloud className="h-5 w-5" />
            <div>
              <strong>目前使用本機 Demo 儲存。</strong>
              <span>填入 Firebase 設定後，Google 登入與 Firestore 跨裝置同步會自動啟用。</span>
            </div>
          </section>
        )}

        <section className="grid gap-4 pb-12 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRecords.map((record) => (
            <QuizCard key={record.id} record={record} onOpen={() => openQuiz(record)} onDelete={() => deleteQuiz(record.id)} />
          ))}
        </section>

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
          onUseSample={() => setImportText(JSON.stringify(sampleQuiz, null, 2))}
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

function QuizCard({ record, onOpen, onDelete }: { record: QuizRecord; onOpen: () => void; onDelete: () => void }) {
  const total = questionCount(record.quiz);
  const progress = total ? Math.round((answeredCount(record) / total) * 100) : 0;
  return (
    <article className="quiz-card group">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <span className="category-pill">{record.quiz.category || '未分類'}</span>
          <h2 className="mt-4 line-clamp-2 text-2xl font-semibold tracking-normal">{record.quiz.title}</h2>
        </div>
        <button className="icon-button danger" type="button" aria-label="刪除 Quiz" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="line-clamp-2 min-h-12 text-sm leading-6 text-zinc-500">{record.quiz.description || '這份 Quiz 尚未加入描述。'}</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        <PreviewStat label="Part" value={record.quiz.sections.length} />
        <PreviewStat label="成語" value={studyCount(record.quiz)} />
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
}) {
  const section = record.quiz.sections[sectionIndex];
  const checked = Boolean(record.progress.checkedSections?.[section.id]);
  const answered = section.questions.filter((question) => record.progress.answers[question.id]).length;
  const score = sectionScore(section, record.progress);
  const allAnswered = answered === section.questions.length;
  const total = questionCount(record.quiz);
  const totalDone = answeredCount(record);

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
                    <p className="mt-1 text-sm text-zinc-500">每個播放鍵會念「成語，意思：內容」，不會朗讀選擇題。</p>
                  </div>
                  <button className="dark-button" type="button" onClick={() => onMode('quiz')}>開始本 Part 題目<ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="term-grid">
                {section.studyItems.map((item, index) => (
                  <article className="term-card" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="term-index">{String(index + 1).padStart(2, '0')}</span>
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">一次完成本 Part 的所有題目</h3>
                    <p className="mt-1 text-sm text-zinc-500">已選 {answered} / {section.questions.length}{checked ? `，本次答對 ${score} 題` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="quiet-button" type="button" onClick={onResetSection}><RefreshCw className="h-4 w-4" />重做</button>
                    <button className="dark-button" type="button" disabled={!allAnswered} onClick={onCheck}><Check className="h-4 w-4" />批改</button>
                  </div>
                </div>
              </div>

              {section.questions.map((question, index) => {
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
  onUseSample,
  onSubmit,
}: {
  value: string;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onUseSample: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="新增 Quiz">
      <section className="modal-card">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">新增 Quiz</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">貼上固定 JSON</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">JSON 需包含標題、Part、成語教材與題目；成語必須填 meaning。也可使用 parts、terms、options、correctAnswer。</p>
          </div>
          <button className="icon-button" type="button" aria-label="關閉" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="schema-strip">
          <span>title</span><span>sections / parts</span><span>studyItems / terms</span><span>term / idiom</span><span>meaning</span><span>questions</span><span>choices / options</span><span>correctChoiceId / correctAnswer</span>
        </div>
        <textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} placeholder="把 ChatGPT 產生的 quiz-json-v1 貼在這裡" />
        {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button className="quiet-button" type="button" onClick={onUseSample}><FileJson className="h-4 w-4" />放入範例 JSON</button>
          <button className="dark-button" type="button" onClick={onSubmit}><Plus className="h-4 w-4" />建立 Quiz</button>
        </div>
      </section>
    </div>
  );
}

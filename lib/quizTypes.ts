export type ChoiceId = 'A' | 'B' | 'C' | 'D' | string;

export type QuizChoice = {
  id: ChoiceId;
  text: string;
};

export type StudyItem = {
  id: string;
  type: 'idiom' | 'vocabulary' | 'term';
  term: string;
  speakText?: string;
  reading?: string;
  meaning: string;
  explanation?: string;
  detail?: string;
  notes?: string[];
};

export type QuizQuestion = {
  id: string;
  type: 'multipleChoice';
  prompt: string;
  choices: QuizChoice[];
  correctChoiceId: ChoiceId;
  explanation?: string;
  detail?: string;
  relatedItemIds?: string[];
};

export type QuizSection = {
  id: string;
  title: string;
  subtitle?: string;
  order?: number;
  studyItems: StudyItem[];
  questions: QuizQuestion[];
};

export type QuizDocument = {
  schemaVersion: 'quiz-json-v1';
  title: string;
  category?: string;
  description?: string;
  locale?: string;
  sections: QuizSection[];
  createdBy?: string;
};

export type QuizProgress = {
  lastSectionId?: string;
  answers: Record<string, ChoiceId>;
  checkedSections: Record<string, boolean>;
  questionOrderBySection?: Record<string, string[]>;
};

export type QuizRecord = {
  id: string;
  quiz: QuizDocument;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  progress: QuizProgress;
};

import { z } from 'zod';

export const NotesZ = z.object({
  summary: z.string(),
  eli5: z.string(),
  key_points: z.array(z.string()).optional(),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() })).optional(),
}).strict();

export const FlashcardZ = z.object({
  cards: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  })),
}).strict();

export const ExamPrepZ = z.object({
  title: z.string(),
  summary: z.string(),
  questions: z.array(z.object({
    id: z.number(),
    question: z.string(),
    options: z.array(z.string()),
    answerIndex: z.number(),
    explanation: z.string(),
    timestamp: z.string().optional(),
  })),
}).strict();

export const MindMapZ = z.object({
  topic: z.string(),
  nodes: z.array(z.object({
    label: z.string(),
    summary: z.string(),
    subtopics: z.array(z.string()),
  })),
}).strict();

export const RevisionPlanZ = z.object({
  title: z.string(),
  total_days: z.number(),
  daily_plan: z.array(z.object({
    day: z.number(),
    topic: z.string(),
    tasks: z.array(z.string()),
    estimated_minutes: z.number(),
  })),
}).strict();

export const FlashcardItemZ = z.object({
  question: z.string(),
  answer: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export type NotesType = z.infer<typeof NotesZ>;
export type FlashcardType = z.infer<typeof FlashcardZ>;
export type ExamPrepType = z.infer<typeof ExamPrepZ>;
export type MindMapType = z.infer<typeof MindMapZ>;
export type RevisionPlanType = z.infer<typeof RevisionPlanZ>;

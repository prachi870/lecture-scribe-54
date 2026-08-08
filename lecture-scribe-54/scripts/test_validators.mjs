import { NotesZ, FlashcardZ, ExamPrepZ, MindMapZ, RevisionPlanZ } from '../src/lib/ai.schemas.js';

function test() {
  console.log('Testing validators');

  const goodNotes = {
    summary: 'This is a summary.',
    eli5: 'Simple explanation.',
    key_points: ['a', 'b'],
    glossary: [{ term: 't', definition: 'd' }],
  };

  const badNotes = { summary: 1 };

  console.log('Notes good:', NotesZ.safeParse(goodNotes).success);
  console.log('Notes bad:', NotesZ.safeParse(badNotes).success);

  const goodFlash = { cards: [ { question: 'Q', answer: 'A', difficulty: 'easy' } ] };
  const badFlash = { cards: [ { q: 'Q' } ] };
  console.log('Flash good:', FlashcardZ.safeParse(goodFlash).success);
  console.log('Flash bad:', FlashcardZ.safeParse(badFlash).success);

  const goodExam = { title: 'T', summary: 'S', questions: [ { id: 1, question: 'Q', options: ['a','b','c','d'], answerIndex: 0, explanation: 'E', timestamp: '00:10' } ] };
  const badExam = { title: 'T', questions: [] };
  console.log('Exam good:', ExamPrepZ.safeParse(goodExam).success);
  console.log('Exam bad:', ExamPrepZ.safeParse(badExam).success);

  const goodMind = { topic: 't', nodes: [ { label: 'L', summary: 'S', subtopics: ['a'] } ] };
  console.log('Mind good:', MindMapZ.safeParse(goodMind).success);

  const goodRev = { title: 't', total_days: 3, daily_plan: [ { day: 1, topic: 't', tasks: ['a'], estimated_minutes: 10 } ] };
  console.log('Rev good:', RevisionPlanZ.safeParse(goodRev).success);
}

test();

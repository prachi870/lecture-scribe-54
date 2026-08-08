import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
// Inline zod schemas to mirror src/lib/ai.schemas.ts validators (avoid importing TS files)
const NotesZ = z.object({
  summary: z.string(),
  eli5: z.string(),
  key_points: z.array(z.string()),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() }))
});
const FlashcardZ = z.object({ cards: z.array(z.object({ question: z.string(), answer: z.string(), difficulty: z.string().optional() })) });
const ExamPrepZ = z.object({ title: z.string(), summary: z.string(), questions: z.array(z.any()) });
const MindMapZ = z.object({ topic: z.string(), nodes: z.array(z.any()) });
const RevisionPlanZ = z.object({ title: z.string(), total_days: z.number(), daily_plan: z.array(z.any()) });

// Simple .env loader
function loadDotEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2] || '';
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  } catch (e) {}
}
// Try multiple locations for .env: cwd and the project subfolder
loadDotEnv(path.resolve(process.cwd(), '.env'));
loadDotEnv(path.resolve(process.cwd(), 'lecture-scribe-54', '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function createSilentWavBuffer(durationSec = 10) {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function run() {
  try {
    const email = `mock_e2e_${Date.now()}@example.com`;
    const pw = 'Test1234!';
    console.log('Creating test user', email);
    // create user via admin
    const createRes = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: 'Mock E2E' } });
    if (createRes.error) {
      console.error('admin.createUser failed:', createRes.error);
      process.exit(1);
    }
    // support multiple possible shapes
    const userId = createRes.data?.user?.id || createRes.user?.id || createRes.data?.id || createRes.id;
    console.log('createRes raw:', createRes);
    if (!userId) { console.error('Could not determine created user id from response'); process.exit(1); }
    console.log('Created user id', userId);

    // upload wav to storage
    const wavBuf = createSilentWavBuffer(10);
    const filePath = `${userId}/mock_e2e.wav`;
    console.log('Uploading wav to storage at', filePath);
    const up = await admin.storage.from('lecture-audio').upload(filePath, wavBuf, { contentType: 'audio/wav', upsert: true });
    if (up.error) {
      console.error('Storage upload failed:', up.error.message);
      process.exit(1);
    }
    console.log('Upload ok, path:', up.data.path);

    // create lecture row
    const { data: lectureRow, error: lecErr } = await admin
      .from('lectures')
      .insert({ title: 'Mock E2E Lecture', user_id: userId, status: 'processing', audio_path: up.data.path, transcript_status: 'pending' })
      .select('id')
      .single();
    if (lecErr) { console.error('Lecture insert failed:', lecErr); process.exit(1); }
    const lectureId = lectureRow.id;
    console.log('Lecture created id', lectureId);

    // Segment the audio using ffmpeg like test
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mock-aud-'));
    const inPath = path.join(tmpDir, 'in.wav');
    await fs.promises.writeFile(inPath, wavBuf);
    console.log('WAV written to', inPath);

    // run ffmpeg segmentation (5s segments)
    const ffmpegStatic = await import('ffmpeg-static');
    const ffmpegModule = await import('fluent-ffmpeg');
    const ffmpeg = ffmpegModule.default || ffmpegModule;
    ffmpeg.setFfmpegPath(ffmpegStatic.default || ffmpegStatic);
    const outPattern = path.join(tmpDir, 'seg%03d.wav');
    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .outputOptions(['-f','segment','-segment_time','5','-c:a','pcm_s16le','-ar','16000','-ac','1'])
        .output(outPattern)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const files = await fs.promises.readdir(tmpDir);
    const segs = files.filter(f => f.startsWith('seg') && f.endsWith('.wav')).sort();
    console.log('Segments produced:', segs.length);

    // Mock transcription: simulate a failure for segment index 1
    const transcripts = [];
    const failed = [];
    for (let i=0;i<segs.length;i++){
      if (i===1){
        // simulate failure
        console.log('Simulating transcription failure for segment', i+1);
        failed.push(i);
        transcripts.push(`[Transcription segment ${i+1} failed after retries]`);
      } else {
        transcripts.push(`Transcribed text for segment ${i+1}`);
      }
    }

    const finalTranscript = transcripts.join('\n\n') + (failed.length ? `\n\n[NOTE: Transcription completed with ${failed.length} failed segments: ${failed.join(', ')}]` : '');

    // Update lecture row with transcript
    const { error: updErr } = await admin.from('lectures').update({ transcript: finalTranscript, transcript_status: 'completed', transcript_error: null, transcribed_at: new Date().toISOString(), status: 'ready' }).eq('id', lectureId);
    if (updErr) { console.error('Failed updating lecture transcript:', updErr); process.exit(1); }
    console.log('Lecture transcript updated');

    // Generate mock notes and validate
    const notesMock = {
      summary: 'Mock summary paragraph 1. Mock paragraph 2.',
      eli5: 'Simple explanation for kids.',
      key_points: ['kp1','kp2','kp3','kp4','kp5'],
      glossary: [{ term: 'term1', definition: 'def1' }, { term: 'term2', definition: 'def2' }]
    };
    console.log('Validating notes with zod');
    const notesCheck = NotesZ.safeParse(notesMock);
    if (!notesCheck.success) { console.error('Notes validation failed', notesCheck.error.format()); process.exit(1); }

    // upsert lecture_notes
    const { error: notesUpErr } = await admin.from('lecture_notes').upsert({ lecture_id: lectureId, summary: notesMock.summary, eli5: notesMock.eli5, key_points: notesMock.key_points, glossary: notesMock.glossary, generated_at: new Date().toISOString() }, { onConflict: 'lecture_id' });
    if (notesUpErr) { console.error('Failed upserting lecture_notes:', notesUpErr); process.exit(1); }
    console.log('Lecture notes upserted');

    // Generate mock flashcards
    const flashMock = { cards: [ { question: 'What is X?', answer: 'X is ...', difficulty: 'easy' }, { question: 'Define Y', answer: 'Y is ...', difficulty: 'medium' } ] };
    const flashCheck = FlashcardZ.safeParse(flashMock);
    if (!flashCheck.success) { console.error('Flashcards validation failed', flashCheck.error.format()); process.exit(1); }

    // wipe & insert
    await admin.from('flashcards').delete().eq('lecture_id', lectureId);
    const rows = flashMock.cards.map(c => ({ lecture_id: lectureId, question: c.question.slice(0,500), answer: c.answer.slice(0,2000), difficulty: c.difficulty || 'medium' }));
    const { error: insertFlashErr } = await admin.from('flashcards').insert(rows);
    if (insertFlashErr) { console.error('Flashcard insert failed', insertFlashErr); process.exit(1); }
    console.log('Flashcards inserted:', rows.length);

    // Validate exam prep / mind map / revision plan schemas (no DB insert)
    const examMock = { title: 'Exam Mock', summary: 'Short summary', questions: [ { id: 1, question: 'Q1', options: ['a','b','c','d'], answerIndex: 0, explanation: 'E', timestamp: '00:05' } ] };
    const examOK = ExamPrepZ.safeParse(examMock);
    console.log('Exam mock valid:', examOK.success);

    const mindMock = { topic: 'T', nodes: [ { label: 'L', summary: 'S', subtopics: ['a','b'] } ] };
    console.log('Mind mock valid:', MindMapZ.safeParse(mindMock).success);

    const revMock = { title: 'Rev', total_days: 3, daily_plan: [ { day: 1, topic: 'T', tasks: ['a'], estimated_minutes: 10 } ] };
    console.log('Revision mock valid:', RevisionPlanZ.safeParse(revMock).success);

    // Final DB checks: fetch rows and report
    const { data: lec } = await admin.from('lectures').select('id, transcript, transcript_status, status').eq('id', lectureId).single();
    console.log('Lecture check:', { id: lec.id, transcript_status: lec.transcript_status, status: lec.status, transcript_preview: String(lec.transcript).slice(0,200) });

    const { data: ln } = await admin.from('lecture_notes').select('*').eq('lecture_id', lectureId).maybeSingle();
    console.log('Lecture notes row present:', !!ln);

    const { data: fc } = await admin.from('flashcards').select('id, question').eq('lecture_id', lectureId);
    console.log('Flashcards count:', (fc||[]).length);

    // Cleanup storage and lecture to leave environment tidy
    await admin.storage.from('lecture-audio').remove([filePath]);
    await admin.from('flashcards').delete().eq('lecture_id', lectureId);
    await admin.from('lecture_notes').delete().eq('lecture_id', lectureId);
    await admin.from('lectures').delete().eq('id', lectureId);
    console.log('Cleanup done');

    // remove tmp files
    try { for (const f of files) await fs.promises.unlink(path.join(tmpDir, f)); await fs.promises.rmdir(tmpDir); } catch(e){}

    console.log('Mock E2E pipeline completed successfully');
  } catch (err) {
    console.error('Mock E2E failed:', err);
    process.exit(1);
  }
}

run();

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase URL or key in environment.');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function createSilentWav(durationSec = 1) {
  // 1 sec, 16000Hz, mono, 16-bit PCM
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // silence (zeros) already zeroed
  return buffer;
}

async function run() {
  try {
    // Create test user
    const email = `e2e_test_${Date.now()}@example.com`;
    const pw = 'Test1234!';
    console.log('Signing up test user', email);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password: pw });
    if (signUpErr) {
      console.error('SignUp error:', signUpErr.message);
      return;
    }
    // Immediately sign in
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (signInErr) {
      console.error('SignIn error:', signInErr.message);
      return;
    }
    const session = signInData.session;
    console.log('Signed in, user id:', session.user.id);

    // Use auth for storage upload
    // Need to create a file and upload
    const wav = await createSilentWav(1);
    const filePath = `${session.user.id}/e2e_test_silence.wav`;
    console.log('Uploading to storage at', filePath);
    const uploadRes = await supabase.storage.from('lecture-audio').upload(filePath, wav, { contentType: 'audio/wav', upsert: true });
    if (uploadRes.error) {
      console.error('Upload error:', uploadRes.error.message);
      return;
    }
    console.log('Upload success, path:', uploadRes.data.path);

    // Create lecture record
    const { data: lectureRow, error: lecErr } = await supabase.from('lectures').insert({ title: 'E2E Test Lecture', user_id: session.user.id, status: 'processing', audio_path: uploadRes.data.path, transcript_status: 'pending' }).select('id').single();
    if (lecErr) {
      console.error('Lecture insert error:', lecErr.message);
      return;
    }
    const lectureId = lectureRow.id;
    console.log('Created lecture id:', lectureId);

    // Create signed URL for the audio
    const { data: signed, error: signErr } = await supabase.storage.from('lecture-audio').createSignedUrl(uploadRes.data.path, 60 * 10);
    if (signErr) {
      console.error('CreateSignedUrl error:', signErr.message);
      return;
    }
    const audioUrl = signed.signedUrl;
    console.log('Signed URL obtained:', audioUrl.slice(0,80));

    // Fetch audio and call Gemini (transcription)
    console.log('Fetching audio data...');
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.error('Failed fetching audio:', audioRes.status);
      return;
    }
    const arrayBuffer = await audioRes.arrayBuffer();
    const buf = Buffer.from(arrayBuffer).toString('base64');
    console.log('Calling Gemini to transcribe...');

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: 'Transcribe this audio file accurately. Return only the transcribed text.' }, { inlineData: { mimeType: 'audio/wav', data: buf } }] }],
      config: { temperature: 0.1, maxOutputTokens: 32768 }
    });

    const text = response.text?.trim() ?? '';
    console.log('Gemini transcription result:', text ? text.slice(0,200) : '<empty>');

    // Update lecture with transcript
    const { error: upErr } = await supabase.from('lectures').update({ transcript: text, transcript_status: 'completed', status: 'ready', transcribed_at: new Date().toISOString() }).eq('id', lectureId).eq('user_id', session.user.id);
    if (upErr) console.error('Lecture update error:', upErr.message);
    else console.log('Lecture updated with transcript.');

    // Call generate notes via direct geminiChatJSON
    const truncated = text.slice(0,20000);
    const prompt = `Transcript:\n\n${truncated}\n\nReturn JSON with fields: summary (2-3 paragraphs), eli5 (explain like I'm 12, 1 paragraph), key_points (array of 5-10 short bullet strings), glossary (array of {term, definition}).`;
    const sys = 'You are an expert study-notes generator. Return ONLY valid JSON with the exact shape requested. No prose outside JSON.';

    const notesRes = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction: sys, responseMimeType: 'application/json', responseSchema: { type: 'object' }, temperature: 0.7 }
    });
    console.log('Notes raw:', notesRes.text?.slice(0,400));

  } catch (err) {
    console.error('E2E script error:', err);
  }
}

run();

import { promises as fs } from 'node:fs';
import { geminiTranscribe } from './src/lib/gemini.ts';

const envText = await fs.readFile('./.env', 'utf8');
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key] = rest.join('=').trim();
}
if (!env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY missing');
  process.exit(2);
}
process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
process.env.OPENAI_TRANSCRIBE_MODEL = env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

const size = 44 + 16000 * 2;
const buffer = new ArrayBuffer(size);
const dv = new DataView(buffer);
let offset = 0;
const writeString = (str: string) => { for (let i = 0; i < str.length; i++) dv.setUint8(offset++, str.charCodeAt(i)); };
writeString('RIFF');
dv.setUint32(offset, 36 + 16000 * 2, true); offset += 4;
writeString('WAVE');
writeString('fmt '); dv.setUint32(offset, 16, true); offset += 4;
dv.setUint16(offset, 1, true); offset += 2;
dv.setUint16(offset, 1, true); offset += 2;
dv.setUint32(offset, 16000, true); offset += 4;
dv.setUint32(offset, 16000 * 2, true); offset += 4;
dv.setUint16(offset, 2, true); offset += 2;
dv.setUint16(offset, 16, true); offset += 2;
writeString('data'); dv.setUint32(offset, 16000 * 2, true); offset += 4;
for (let i = 0; i < 16000; i++) dv.setInt16(offset + i * 2, 0, true);
const blob = new Blob([buffer], { type: 'audio/wav' });

try {
  const transcript = await geminiTranscribe(blob, 'test.wav');
  console.log('transcript success:', transcript.slice(0, 200));
} catch (err) {
  console.error('transcribe error', err instanceof Error ? err.message : err);
  // @ts-ignore
  if (err?.responseText) console.error('responseText', err.responseText.slice(0, 400));
  process.exit(1);
}

const { promises: fs } = require('node:fs');
const path = require('node:path');
const jiti = require('./node_modules/jiti')({ requireCache: false });

(async () => {
  const envText = await fs.readFile('./.env', 'utf8');
  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim();
  }
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  process.env.OPENAI_TRANSCRIBE_MODEL = env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

  const { geminiTranscribe } = jiti('./src/lib/gemini.ts');
  const wav = new Uint8Array(44 + 16000 * 2);
  const dv = new DataView(wav.buffer);
  let offset = 0;
  const writeString = (s) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(offset++, s.charCodeAt(i));
  };
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
  for (let i = 0; i < 16000; i++) dv.setInt16(offset + i*2, 0, true);
  const blob = new Blob([wav], { type: 'audio/wav' });
  try {
    const transcript = await geminiTranscribe(blob, 'test.wav');
    console.log('transcript success:', transcript.slice(0, 200));
  } catch (err) {
    console.error('transcribe error', err?.message || err);
    if (err.responseText) console.error('responseText', err.responseText.slice(0, 400));
    process.exit(1);
  }
})();

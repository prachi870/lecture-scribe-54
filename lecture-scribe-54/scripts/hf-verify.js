/*
  Hugging Face connectivity verification script.
  - Reads HUGGINGFACE_API_KEY from env
  - Tests text-generation and speech-to-text endpoints
  - Prints a single JSON object with sanitized results to stdout

  Usage: node scripts/hf-verify.js
  DO NOT commit your API key; in CI provide it via secrets (HUGGINGFACE_API_KEY)
*/

async function run() {
  const key = (process.env.HUGGINGFACE_API_KEY || '').trim();
  if (!key) {
    console.error(JSON.stringify({ error: 'HUGGINGFACE_API_KEY missing' }));
    process.exit(2);
  }

  const genModel = (process.env.HUGGINGFACE_GENERATE_MODEL || 'gpt2').trim();
  const sttModel = (process.env.HUGGINGFACE_TRANSCRIBE_MODEL || 'openai/whisper-small').trim();

  const out = { textGeneration: null, speechToText: null };

  // Helper to normalize response into a short preview without exposing tokens
  async function normalizeResp(res) {
    const ct = res.headers.get('content-type') || '';
    let bodyText = '';
    try {
      if (ct.includes('application/json')) {
        const j = await res.json();
        // Extract likely text fields
        const cand = j.generated_text ?? j.text ?? (Array.isArray(j) && j[0] && (j[0].generated_text || j[0].text)) ?? null;
        if (cand && typeof cand === 'string') bodyText = cand.slice(0, 400);
        else {
          const s = JSON.stringify(j);
          bodyText = s.length > 400 ? s.slice(0, 400) + '...' : s;
        }
      } else {
        const t = await res.text();
        bodyText = t.slice(0, 400);
      }
    } catch (e) {
      bodyText = `failed_to_parse_response: ${String(e.message || e)}`;
    }
    return bodyText;
  }

  // Text generation test
  try {
    const genUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(genModel)}`;
    const genResp = await fetch(genUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ inputs: 'Translate to Spanish: Hello, how are you?' }),
    });
    const preview = await normalizeResp(genResp);
    out.textGeneration = { ok: genResp.ok, status: genResp.status, model: genModel, preview };
  } catch (e) {
    out.textGeneration = { ok: false, status: null, model: genModel, error: String(e.message || e) };
  }

  // Speech-to-text test (tiny silent wav)
  try {
    // Build a 1s silent 16kHz 16-bit mono WAV (RIFF)
    const sampleRate = 16000;
    const durationSeconds = 1;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * 2; // 16-bit
    const buf = Buffer.alloc(44 + dataSize);
    let offset = 0;
    function writeString(s) { buf.write(s, offset, 'ascii'); offset += s.length; }
    function writeUInt32(v) { buf.writeUInt32LE(v, offset); offset += 4; }
    function writeUInt16(v) { buf.writeUInt16LE(v, offset); offset += 2; }
    writeString('RIFF');
    writeUInt32(36 + dataSize);
    writeString('WAVE');
    writeString('fmt ');
    writeUInt32(16);
    writeUInt16(1);
    writeUInt16(1);
    writeUInt32(sampleRate);
    writeUInt32(sampleRate * 2);
    writeUInt16(2);
    writeUInt16(16);
    writeString('data');
    writeUInt32(dataSize);
    // data area left as zeros (silence)

    const sttUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(sttModel)}`;
    const sttResp = await fetch(sttUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'audio/wav',
        Accept: '*/*',
      },
      body: buf,
    });

    const sttPreview = await normalizeResp(sttResp);
    out.speechToText = { ok: sttResp.ok, status: sttResp.status, model: sttModel, preview: sttPreview };
  } catch (e) {
    out.speechToText = { ok: false, status: null, model: sttModel, error: String(e.message || e) };
  }

  console.log(JSON.stringify(out, null, 2));
}

run().catch((e)=>{ console.error(JSON.stringify({ error: String(e.message || e) })); process.exit(1); });

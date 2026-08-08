export function getHfKey(): string {
  const k = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!k) throw new Error('Missing HUGGINGFACE_API_KEY environment variable for Hugging Face');
  return k;
}

async function hfRequest(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    let message = `Hugging Face request failed with status ${res.status}`;
    try {
      const j = JSON.parse(text);
      message = j.error?.message ?? JSON.stringify(j);
    } catch {
      if (text) message = text;
    }
    const err: any = new Error(message);
    err.status = res.status;
    err.responseText = text;
    throw err;
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return JSON.parse(text);
  return text;
}

export async function huggingfaceTranscribeBlob(audioBlob: Blob, fileName: string): Promise<string> {
  const model = process.env.HUGGINGFACE_TRANSCRIBE_MODEL?.trim() || 'openai/whisper-small';
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
  const resp = await hfRequest(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getHfKey()}`,
      'Content-Type': audioBlob.type || 'audio/wav',
      Accept: 'text/plain',
    },
    body: audioBlob as any,
  });

  if (typeof resp === 'string') {
    const t = resp.trim();
    if (!t) throw new Error('Empty Hugging Face transcription response');
    return t;
  }
  if (typeof resp === 'object' && resp !== null) {
    // common fields
    const r: any = resp as any;
    if (typeof r.text === 'string' && r.text.trim()) return r.text.trim();
    if (typeof r.generated_text === 'string' && r.generated_text.trim()) return r.generated_text.trim();
    if (Array.isArray(r) && r[0] && typeof r[0].generated_text === 'string') return r[0].generated_text.trim();
  }
  throw new Error('Unexpected Hugging Face transcription response format');
}

export async function huggingfaceTextGenerate(model: string, prompt: string, parameters?: Record<string, any>): Promise<string> {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
  const payload: any = { inputs: prompt };
  if (parameters && Object.keys(parameters).length) payload.parameters = parameters;
  const resp = await hfRequest(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getHfKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (typeof resp === 'string') return resp.trim();
  const r: any = resp as any;
  if (typeof r.generated_text === 'string') return r.generated_text.trim();
  if (Array.isArray(r) && r[0] && typeof r[0].generated_text === 'string') return r[0].generated_text.trim();
  if (typeof r.text === 'string') return r.text.trim();
  if (Array.isArray(r) && typeof r[0]?.text === 'string') return r[0].text.trim();
  try { const s = JSON.stringify(r); if (s && s.length < 4000) return s; } catch {}
  throw new Error('Unexpected Hugging Face generation response format');
}

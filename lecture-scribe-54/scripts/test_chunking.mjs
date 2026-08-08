import fs from 'fs';
import os from 'os';
import path from 'path';

// Dynamic imports for ffmpeg/static and fluent-ffmpeg
const ffmpegStatic = await import('ffmpeg-static');
const ffmpegModule = await import('fluent-ffmpeg');
const ffmpeg = ffmpegModule.default || ffmpegModule;
ffmpeg.setFfmpegPath(ffmpegStatic.default || ffmpegStatic);

function createSilentWavBuffer(durationSec = 30) {
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
  // silence already zero
  return buffer;
}

async function run() {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-chunk-'));
  const inPath = path.join(tmpDir, 'in.wav');
  const outPattern = path.join(tmpDir, 'seg%03d.wav');
  console.log('Temp dir:', tmpDir);

  // create 30s silent wav
  const wavBuf = createSilentWavBuffer(30);
  await fs.promises.writeFile(inPath, wavBuf);
  console.log('WAV written:', inPath, 'size:', wavBuf.length);

  const segmentTime = 5; // seconds
  console.log('Running ffmpeg segmentation with segment_time=', segmentTime);

  await new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', String(segmentTime),
        '-c:a', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
      ])
      .output(outPattern)
      .on('start', (cmd) => console.log('ffmpeg start:', cmd))
      .on('end', () => {
        console.log('ffmpeg end');
        resolve();
      })
      .on('error', (err) => reject(err))
      .run();
  });

  const files = await fs.promises.readdir(tmpDir);
  const segs = files.filter((f) => f.startsWith('seg') && f.endsWith('.wav')).sort();
  console.log('Segments produced:', segs.length);
  for (const s of segs) {
    const p = path.join(tmpDir, s);
    const stat = await fs.promises.stat(p);
    const head = await fs.promises.readFile(p, { encoding: 'utf8', flag: 'r' }).catch(() => null);
    const hdrBuf = Buffer.alloc(16);
    await fs.promises.readFile(p).then((b) => b.copy(hdrBuf, 0, 0, 16));
    const riff = hdrBuf.toString('utf8', 0, 4);
    console.log(' -', s, 'size:', stat.size, 'headerRIFF=', riff);
  }

  // cleanup
  try {
    for (const f of files) await fs.promises.unlink(path.join(tmpDir, f));
    await fs.promises.rmdir(tmpDir);
  } catch (e) {
    // ignore
  }
}

run().then(() => console.log('Done')).catch((err) => { console.error('Test failed:', err); process.exit(1); });

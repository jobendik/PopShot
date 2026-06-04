#!/usr/bin/env node
// ============================================================================
// compress-audio.mjs — ship-tree audio compressor for Bubble Breaker Adventure
// ============================================================================
//
// WHY: the WAV masters in public/sfx/ (~170 MB) get copied verbatim into dist/
// by Vite, blowing past CrazyGames' load-time bar. The runtime loader
// (src/systems/audio.ts) already probes .ogg → .mp3 → .wav, so dropping a
// compressed sibling next to each WAV is enough — no loader change needed.
//
// WHAT IT DOES (idempotent, re-runnable):
//   1. For every public/sfx/**/*.wav, emit a sibling .ogg (libvorbis -q:a 4)
//      AND .mp3 (libmp3lame -q:a 4), preserving directory structure and the
//      source channel count. A target is skipped if it already exists and is
//      newer than its WAV source.
//   2. Re-encode public/music/*.mp3 in place to -b:a 128k (these big loops are
//      streamed by HTMLAudioElement and stay .mp3). Music already at/below
//      ~140k is left untouched so repeated runs don't re-degrade it.
//
// LOOP SAFETY: *_loop* files and anything under ambient/ loop seamlessly as a
// decoded Vorbis AudioBuffer; MP3 can introduce encoder-padding seams. Both are
// generated, but loop files are flagged in the report for an ear-check. The
// loader's default .ogg-first order means the clean Vorbis copy wins anyway.
//
// USAGE:
//   node tools/compress-audio.mjs           # convert sfx + music
//   node tools/compress-audio.mjs --check   # validate referenced ids resolve
//   node tools/compress-audio.mjs --convert --check   # both
//
// ffmpeg/ffprobe are taken from PATH, override with FFMPEG / FFPROBE env vars.
// ============================================================================

import { spawnSync } from 'node:child_process';
import {
  readdirSync, statSync, existsSync, renameSync, unlinkSync, readFileSync, mkdirSync,
} from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Shipped tree — the compressed .ogg/.mp3 the game actually loads live here.
const SFX_DIR = join(ROOT, 'public', 'sfx');
const MUSIC_DIR = join(ROOT, 'public', 'music');
const SRC_DIR = join(ROOT, 'src');
// WAV masters live OUTSIDE the shipped tree (gitignored, see .gitignore). The
// script reads masters from here and from public/sfx itself (so a WAV dropped
// straight into the shipped tree is still picked up), always writing the
// compressed siblings into public/sfx mirroring the source structure.
const ASSETS_SRC_SFX = join(ROOT, 'assets-src', 'sfx');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';

// SFX encode quality (≈128k VBR for both codecs).
const OGG_QUALITY = ['-c:a', 'libvorbis', '-q:a', '4'];
const MP3_QUALITY = ['-c:a', 'libmp3lame', '-q:a', '4'];
// Music: large streamed loops — constant 128k is plenty.
const MUSIC_BITRATE = '128k';
// Music already at/under this is considered "already compressed" → skip.
const MUSIC_SKIP_BITRATE = 140_000;

const VARIANTS = ['01', '02', '03'];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function walk(dir, filterExt) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p, filterExt));
    else if (!filterExt || ent.name.toLowerCase().endsWith(filterExt)) out.push(p);
  }
  return out;
}

const mtime = (p) => statSync(p).mtimeMs;
const size = (p) => (existsSync(p) ? statSync(p).size : 0);
const fmt = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);
const upToDate = (src, dst) => existsSync(dst) && mtime(dst) >= mtime(src);
const isLoop = (rel) => /_loop/i.test(rel) || rel.split(sep)[0] === 'ambient';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    const msg = (r.stderr || r.error?.message || '').trim().split('\n').slice(-3).join('\n');
    throw new Error(`${cmd} failed (${r.status}): ${msg}`);
  }
  return r;
}

function encode(src, dst, qualityArgs) {
  // -y overwrite, -vn drop any cover-art stream. Channel count is preserved by
  // default (no -ac), satisfying the "preserve channel count" requirement.
  run(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-vn', ...qualityArgs, dst]);
}

function probeBitrate(file) {
  const r = spawnSync(FFPROBE, [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=bit_rate', '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8' });
  const n = parseInt((r.stdout || '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// SFX: wav -> ogg + mp3
// ---------------------------------------------------------------------------
function collectMasters() {
  // (relPath, absWav) from every master root. public/sfx wins on collision so a
  // WAV dropped into the shipped tree overrides an assets-src master of same id.
  const byRel = new Map();
  for (const root of [ASSETS_SRC_SFX, SFX_DIR]) {
    for (const wav of walk(root, '.wav')) byRel.set(relative(root, wav), wav);
  }
  return [...byRel.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function convertSfx() {
  const masters = collectMasters();
  if (!masters.length) {
    console.log('SFX: no WAV masters found (assets-src/sfx or public/sfx).\n');
    return { srcBytes: 0, oggBytes: 0, mp3Bytes: 0, loops: [], converted: 0, skipped: 0 };
  }
  console.log(`SFX: ${masters.length} WAV masters → ogg + mp3 (into public/sfx)\n`);
  let srcBytes = 0, oggBytes = 0, mp3Bytes = 0, converted = 0, skipped = 0;
  const loops = [];
  for (const [rel, wav] of masters) {
    const outBase = join(SFX_DIR, rel.slice(0, -4)); // drop .wav, mirror into public/sfx
    mkdirSync(dirname(outBase), { recursive: true });
    const ogg = `${outBase}.ogg`;
    const mp3 = `${outBase}.mp3`;
    const wavSize = size(wav);
    srcBytes += wavSize;
    if (isLoop(rel)) loops.push(rel.replaceAll(sep, '/'));

    let did = false;
    if (!upToDate(wav, ogg)) { encode(wav, ogg, OGG_QUALITY); did = true; }
    if (!upToDate(wav, mp3)) { encode(wav, mp3, MP3_QUALITY); did = true; }
    did ? converted++ : skipped++;

    const o = size(ogg), m = size(mp3);
    oggBytes += o; mp3Bytes += m;
    const pct = wavSize ? (100 * (1 - (o + m) / 2 / wavSize)).toFixed(0) : '0';
    console.log(
      `  ${did ? '✓' : '·'} ${rel.replaceAll(sep, '/').padEnd(44)} ` +
      `${fmt(wavSize).padStart(10)} → ogg ${fmt(o).padStart(9)} | mp3 ${fmt(m).padStart(9)}  (~${pct}% smaller)` +
      `${isLoop(rel) ? '  [LOOP]' : ''}`,
    );
  }
  console.log(
    `\nSFX totals: WAV ${fmt(srcBytes)}  →  ogg ${fmt(oggBytes)} + mp3 ${fmt(mp3Bytes)} ` +
    `= ${fmt(oggBytes + mp3Bytes)} shipped  (${converted} converted, ${skipped} up-to-date)\n`,
  );
  return { srcBytes, oggBytes, mp3Bytes, loops, converted, skipped };
}

// ---------------------------------------------------------------------------
// Music: re-encode *.mp3 in place to 128k
// ---------------------------------------------------------------------------
function convertMusic() {
  const mp3s = walk(MUSIC_DIR, '.mp3').sort();
  if (!mp3s.length) { console.log('Music: no mp3 files found.\n'); return { before: 0, after: 0 }; }
  console.log(`Music: ${mp3s.length} mp3 files → ${MUSIC_BITRATE} (in place)\n`);
  let before = 0, after = 0;
  for (const f of mp3s) {
    const rel = relative(MUSIC_DIR, f).replaceAll(sep, '/');
    const orig = size(f);
    before += orig;
    const br = probeBitrate(f);
    if (br && br <= MUSIC_SKIP_BITRATE) {
      after += orig;
      console.log(`  · ${rel.padEnd(28)} ${fmt(orig).padStart(10)}  (already ${Math.round(br / 1000)}k, skipped)`);
      continue;
    }
    const tmp = `${f}.tmp.mp3`;
    run(FFMPEG, ['-y', '-loglevel', 'error', '-i', f, '-vn', '-c:a', 'libmp3lame', '-b:a', MUSIC_BITRATE, tmp]);
    if (existsSync(f)) unlinkSync(f);
    renameSync(tmp, f);
    const now = size(f);
    after += now;
    console.log(`  ✓ ${rel.padEnd(28)} ${fmt(orig).padStart(10)} → ${fmt(now).padStart(10)}  (was ${Math.round(br / 1000)}k)`);
  }
  console.log(`\nMusic totals: ${fmt(before)} → ${fmt(after)}\n`);
  return { before, after };
}

// ---------------------------------------------------------------------------
// --check : every SFX/music id referenced in src/ must resolve to a shipped
//           .ogg / .mp3 (or, for variant prefixes, at least one _NN variant).
// ---------------------------------------------------------------------------
const SFX_DIRS = [
  'pop', 'weapon', 'ui', 'stinger', 'combo', 'boss', 'hazard', 'pickup',
  'ambient', 'bounce', 'creature', 'panic', 'player',
];

function collectRefs() {
  const sfx = new Set();
  const music = new Set();
  const sfxRe = new RegExp(`['"\`]((?:${SFX_DIRS.join('|')})/[a-z0-9_./]+)['"\`]`, 'g');
  const musicRe = /musicPlay\(\s*['"`]([a-z0-9_]+)['"`]/g;
  for (const f of walk(SRC_DIR, '.ts')) {
    const txt = readFileSync(f, 'utf8');
    for (const m of txt.matchAll(sfxRe)) sfx.add(m[1]);
    for (const m of txt.matchAll(musicRe)) music.add(m[1]);
  }
  return { sfx: [...sfx].sort(), music: [...music].sort() };
}

const hasCompressed = (relId) =>
  existsSync(join(SFX_DIR, `${relId}.ogg`)) || existsSync(join(SFX_DIR, `${relId}.mp3`));
const hasVariant = (relId) =>
  VARIANTS.some((v) => hasCompressed(`${relId}_${v}`));

function check() {
  const { sfx, music } = collectRefs();
  console.log(`Validation: ${sfx.length} sfx ids + ${music.length} music ids referenced in src/\n`);
  const gaps = [];
  for (const id of sfx) {
    const ok = hasCompressed(id) || hasVariant(id);
    if (!ok) gaps.push(`sfx/${id}  (no .ogg/.mp3 and no _NN variant)`);
  }
  for (const id of music) {
    if (!existsSync(join(MUSIC_DIR, `${id}.mp3`))) gaps.push(`music/${id}.mp3  (missing)`);
  }
  if (gaps.length) {
    console.log(`✗ ${gaps.length} unresolved id(s):`);
    for (const g of gaps) console.log(`    - ${g}`);
    console.log('');
    return false;
  }
  console.log('✓ every referenced id resolves to a shipped compressed file.\n');
  return true;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const doCheck = args.includes('--check');
const doConvert = args.includes('--convert') || !doCheck; // default action is convert

let ok = true;
if (doConvert) {
  console.log('=== Compressing audio ===\n');
  const sfx = convertSfx();
  const music = convertMusic();
  const beforeTotal = sfx.srcBytes + music.before;
  const afterTotal = sfx.oggBytes + sfx.mp3Bytes + music.after;
  console.log('=== Shipped-audio summary ===');
  console.log(`  SFX:   ${fmt(sfx.srcBytes)} WAV  →  ${fmt(sfx.oggBytes + sfx.mp3Bytes)} (ogg+mp3)`);
  console.log(`  Music: ${fmt(music.before)}  →  ${fmt(music.after)}`);
  console.log(`  TOTAL: ${fmt(beforeTotal)}  →  ${fmt(afterTotal)}  ` +
    `(${beforeTotal ? (100 * (1 - afterTotal / beforeTotal)).toFixed(1) : 0}% smaller)`);
  if (sfx.loops.length) {
    console.log(`\n  ⚠ ${sfx.loops.length} LOOP file(s) — ear-check the .ogg for seamless looping:`);
    for (const l of sfx.loops) console.log(`      ${l}`);
  }
  console.log('');
}
if (doCheck) ok = check() && ok;

process.exit(ok ? 0 : 1);

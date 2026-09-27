import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as CircleHelp, i as Gauge, o as BookOpen, r as Settings, s as AudioLines, t as Waves } from "../_libs/lucide-react.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B0BMYIub.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EMPTY_META = {
	name: "",
	address: "",
	room: "",
	windows: "unknown",
	direction: "unknown",
	noiseType: "bass",
	note: ""
};
async function sha256Hex(data) {
	const buf = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var IEC = {
	f1: 20.598997,
	f2: 107.65265,
	f3: 737.86223,
	f4: 12194.217
};
/** Transposed direct form II. H(z) = (b0 + b1 z^-1 + b2 z^-2) / (1 + a1 z^-1 + a2 z^-2). */
function tickBiquad(section, x) {
	const y = section.b0 * x + section.z1;
	section.z1 = section.b1 * x - section.a1 * y + section.z2;
	section.z2 = section.b2 * x - section.a2 * y;
	return y;
}
function tickCascade(sections, x) {
	let y = x;
	for (let i = 0; i < sections.length; i++) y = tickBiquad(sections[i], y);
	return y;
}
function highpass1(fc, fs) {
	const w = 2 * Math.PI * fc;
	const k = 2 * fs;
	const norm = 1 / (k + w);
	return {
		b0: k * norm,
		b1: -k * norm,
		b2: 0,
		a1: (w - k) * norm,
		a2: 0,
		z1: 0,
		z2: 0
	};
}
function lowpass1(fc, fs) {
	const w = 2 * Math.PI * fc;
	const k = 2 * fs;
	const norm = 1 / (k + w);
	return {
		b0: w * norm,
		b1: w * norm,
		b2: 0,
		a1: (w - k) * norm,
		a2: 0,
		z1: 0,
		z2: 0
	};
}
function biquadH(section, omega) {
	const z1r = Math.cos(omega);
	const z1i = -Math.sin(omega);
	const z2r = z1r * z1r - z1i * z1i;
	const z2i = 2 * z1r * z1i;
	const nr = section.b0 + section.b1 * z1r + section.b2 * z2r;
	const ni = section.b1 * z1i + section.b2 * z2i;
	const dr = 1 + section.a1 * z1r + section.a2 * z2r;
	const di = section.a1 * z1i + section.a2 * z2i;
	const den = dr * dr + di * di;
	return {
		re: (nr * dr + ni * di) / den,
		im: (ni * dr - nr * di) / den
	};
}
/** Magnitude of a cascade at `freq` Hz. Does not depend on filter state. */
function magnitude(sections, freq, fs) {
	const omega = 2 * Math.PI * freq / fs;
	let re = 1;
	let im = 0;
	for (const section of sections) {
		const h = biquadH(section, omega);
		const nre = re * h.re - im * h.im;
		const nim = re * h.im + im * h.re;
		re = nre;
		im = nim;
	}
	return Math.hypot(re, im);
}
function normalizeAt1k(sections, fs) {
	const scale = 1 / magnitude(sections, 1e3, fs);
	const first = sections[0];
	first.b0 *= scale;
	first.b1 *= scale;
	first.b2 *= scale;
	return sections;
}
/** Digital A, C, or band-limited Z. Fresh delay state. Gain is 0 dB at 1 kHz. */
function designWeighting(kind, fs) {
	if (!(fs > 0)) throw new Error("sample rate must be positive");
	if (kind === "A") return normalizeAt1k([
		highpass1(IEC.f1, fs),
		highpass1(IEC.f1, fs),
		highpass1(IEC.f2, fs),
		highpass1(IEC.f3, fs),
		lowpass1(IEC.f4, fs),
		lowpass1(IEC.f4, fs)
	], fs);
	if (kind === "C") return normalizeAt1k([
		highpass1(IEC.f1, fs),
		highpass1(IEC.f1, fs),
		lowpass1(IEC.f4, fs),
		lowpass1(IEC.f4, fs)
	], fs);
	return normalizeAt1k([highpass1(10, fs), lowpass1(2e4, fs)], fs);
}
var TIME_CONSTANT_S = {
	fast: .125,
	slow: 1
};
function timeWeightAlpha(kind, fs) {
	return Math.exp(-1 / (TIME_CONSTANT_S[kind] * fs));
}
var ExpMeanSquare = class {
	y = 0;
	alpha;
	constructor(kind, fs) {
		this.alpha = timeWeightAlpha(kind, fs);
	}
	reset() {
		this.y = 0;
	}
	push(x) {
		const oneMinus = 1 - this.alpha;
		this.y = this.alpha * this.y + oneMinus * x * x;
		return this.y;
	}
	get ms() {
		return this.y;
	}
};
var LeqAccumulator = class {
	sumSq = 0;
	count = 0;
	reset() {
		this.sumSq = 0;
		this.count = 0;
	}
	push(x) {
		this.sumSq += x * x;
		this.count += 1;
	}
	pushBlock(xs) {
		for (let i = 0; i < xs.length; i++) {
			const x = xs[i];
			this.sumSq += x * x;
		}
		this.count += xs.length;
	}
	get meanSquare() {
		return this.count > 0 ? this.sumSq / this.count : 0;
	}
};
var PeakHold = class {
	peak = 0;
	reset() {
		this.peak = 0;
	}
	push(x) {
		const a = Math.abs(x);
		if (a > this.peak) this.peak = a;
		return this.peak;
	}
};
/** 10 log10(ms) + offset. Empty / silence floors at -200 so logs stay finite. */
function dbFromMeanSquare(ms, offsetDb) {
	if (!(ms > 0)) return -200 + offsetDb;
	return 10 * Math.log10(ms) + offsetDb;
}
function dbFromPeak(peakAbs, offsetDb) {
	if (!(peakAbs > 0)) return -200 + offsetDb;
	return 20 * Math.log10(peakAbs) + offsetDb;
}
/** In-place radix-2 FFT, Hann window, ISO nominal 1/3-octave fold. */
var OCTAVE_CENTERS = [
	25,
	31.5,
	40,
	50,
	63,
	80,
	100,
	125,
	160,
	200,
	250,
	315,
	400,
	500,
	630,
	800,
	1e3,
	1250,
	1600,
	2e3,
	2500,
	3150,
	4e3,
	5e3,
	6300,
	8e3,
	1e4,
	12500,
	16e3
];
var SIXTH = Math.pow(2, 1 / 6);
function bandEdges(fc) {
	return {
		lo: fc / SIXTH,
		hi: fc * SIXTH
	};
}
function hannWindow(n) {
	const w = new Float64Array(n);
	if (n <= 1) {
		if (n === 1) w[0] = 1;
		return w;
	}
	for (let i = 0; i < n; i++) w[i] = .5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
	return w;
}
function fftRadix2(re, im) {
	const n = re.length;
	if (n !== im.length || (n & n - 1) !== 0) throw new Error("FFT length must be a power of two");
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			const tr = re[i];
			re[i] = re[j];
			re[j] = tr;
			const ti = im[i];
			im[i] = im[j];
			im[j] = ti;
		}
	}
	for (let len = 2; len <= n; len <<= 1) {
		const ang = -2 * Math.PI / len;
		const wlenRe = Math.cos(ang);
		const wlenIm = Math.sin(ang);
		for (let i = 0; i < n; i += len) {
			let wRe = 1;
			let wIm = 0;
			const half = len >> 1;
			for (let j = 0; j < half; j++) {
				const uRe = re[i + j];
				const uIm = im[i + j];
				const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
				const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
				re[i + j] = uRe + vRe;
				im[i + j] = uIm + vIm;
				re[i + j + half] = uRe - vRe;
				im[i + j + half] = uIm - vIm;
				const nextRe = wRe * wlenRe - wIm * wlenIm;
				wIm = wRe * wlenIm + wIm * wlenRe;
				wRe = nextRe;
			}
		}
	}
}
/**
* Windowed real FFT → per-bin mean square.
* A full-scale sine (amplitude 1) concentrates about 0.5 mean square near its bin.
*/
function spectrumMeanSquare(samples, window, workRe, workIm) {
	const n = window.length;
	let sumW2 = 0;
	for (let i = 0; i < n; i++) {
		const w = window[i];
		sumW2 += w * w;
		workRe[i] = samples[i] * w;
		workIm[i] = 0;
	}
	fftRadix2(workRe, workIm);
	const half = n >> 1;
	const binMs = new Float64Array(half);
	const norm = sumW2 > 0 ? 1 / sumW2 : 0;
	for (let k = 0; k < half; k++) {
		const p = (workRe[k] * workRe[k] + workIm[k] * workIm[k]) * norm;
		binMs[k] = k === 0 ? p : 2 * p;
	}
	return {
		binHz: 0,
		binMs
	};
}
function foldThirdOctave(binMs, fs, offsetDb, fMax = 2e4) {
	const binHz = fs / (binMs.length * 2);
	const out = [];
	for (const fc of OCTAVE_CENTERS) {
		if (fc >= fMax || fc >= fs / 2) break;
		const { lo, hi } = bandEdges(fc);
		let acc = 0;
		let any = false;
		const k0 = Math.max(1, Math.ceil(lo / binHz));
		const k1 = Math.min(binMs.length - 1, Math.floor(hi / binHz));
		for (let k = k0; k <= k1; k++) {
			acc += binMs[k];
			any = true;
		}
		if (!any) acc = binMs[Math.min(binMs.length - 1, Math.max(1, Math.round(fc / binHz)))];
		out.push({
			fc,
			db: 10 * Math.log10(Math.max(acc, 1e-20)) + offsetDb
		});
	}
	return out;
}
var FftAnalyzer = class {
	size;
	window;
	re;
	im;
	ring;
	ordered;
	write = 0;
	count = 0;
	hop;
	sinceHop = 0;
	constructor(size, overlap = .5) {
		if ((size & size - 1) !== 0 || size < 256) throw new Error("bad fft size");
		this.size = size;
		this.window = hannWindow(size);
		this.re = new Float64Array(size);
		this.im = new Float64Array(size);
		this.ring = new Float64Array(size);
		this.ordered = new Float64Array(size);
		this.hop = Math.max(1, Math.round(size * (1 - overlap)));
	}
	reset() {
		this.write = 0;
		this.count = 0;
		this.sinceHop = 0;
	}
	/**
	* Push samples. `onHop` fires each time a new window is ready (50% overlap by default).
	* Returns the latest hop, or null if the buffer has not filled yet.
	*/
	push(samples, fs, onHop) {
		let ready = null;
		const size = this.size;
		for (let i = 0; i < samples.length; i++) {
			this.ring[this.write] = samples[i];
			this.write++;
			if (this.write === size) this.write = 0;
			if (this.count < size) this.count++;
			this.sinceHop++;
			if (this.count === size && this.sinceHop >= this.hop) {
				this.sinceHop = 0;
				const start = this.write;
				for (let k = 0; k < size; k++) {
					const idx = start + k;
					this.ordered[k] = this.ring[idx < size ? idx : idx - size];
				}
				const spec = spectrumMeanSquare(this.ordered, this.window, this.re, this.im);
				spec.binHz = fs / size;
				ready = spec;
				onHop?.(spec);
			}
		}
		return ready;
	}
};
function pad(n, width = 2) {
	return String(Math.trunc(Math.abs(n))).padStart(width, "0");
}
/** ISO-8601 local time with numeric offset, millisecond precision. */
function isoWithOffset(date) {
	const offMin = -date.getTimezoneOffset();
	const sign = offMin >= 0 ? "+" : "-";
	const abs = Math.abs(offMin);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
function stampFrom(epochMs, monotonicMs, timeZone) {
	return {
		epochMs,
		monotonicMs,
		iso: isoWithOffset(new Date(epochMs)),
		timeZone
	};
}
function fileStamp(date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
function slugPart(value, fallback) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || fallback;
}
function emptyAcc(n) {
	return Array.from({ length: n }, () => ({
		sum: 0,
		n: 0
	}));
}
function accToBands(centers, acc, offset) {
	return acc.map((a, i) => ({
		fc: centers[i] ?? 0,
		db: 10 * Math.log10(a.n > 0 ? a.sum / a.n : 1e-20) + offset
	}));
}
var BLOCK = 1920;
var SoundLevelEngine = class {
	fs;
	fftSize;
	offset;
	sourceLabel;
	mode = "idle";
	demoKind = null;
	timeZone;
	installationIdSha256;
	userAgent;
	modelLabel;
	inputDeviceId = null;
	a = [];
	c = [];
	z = [];
	fastA = new ExpMeanSquare("fast", 48e3);
	slowA = new ExpMeanSquare("slow", 48e3);
	fastC = new ExpMeanSquare("fast", 48e3);
	slowC = new ExpMeanSquare("slow", 48e3);
	fastZ = new ExpMeanSquare("fast", 48e3);
	leqA = new LeqAccumulator();
	leqC = new LeqAccumulator();
	peakA = new PeakHold();
	peakC = new PeakHold();
	fftA;
	fftC;
	fftZ;
	pendA = [];
	pendC = [];
	pendZ = [];
	spectrum = null;
	specColumns = [];
	specColor = "c";
	specCursorMark = 0;
	sampleCursor = 0;
	nextRowAt = 0;
	clipLatchUntil = 0;
	clippedNow = false;
	sessionId = null;
	sessionEvents = [];
	incident = null;
	lastIncident = null;
	incFastAmax = 0;
	incSlowAmax = 0;
	incFastCmax = 0;
	incSlowCmax = 0;
	incFastAmin = Infinity;
	incFastCmin = Infinity;
	incPeakA = 0;
	incPeakC = 0;
	incClipRows = 0;
	incOctA = [];
	incOctC = [];
	incOctCenters = [];
	settled = 0;
	baselineSamplesLeft = 0;
	baselineLeqA = new LeqAccumulator();
	baselineLeqC = new LeqAccumulator();
	baselineStarted = null;
	baselineTargetSec = 0;
	demoPhase = 0;
	listeners = /* @__PURE__ */ new Set();
	constructor(opts = {}) {
		this.fs = opts.sampleRate ?? 48e3;
		this.fftSize = opts.fftSize ?? 4096;
		this.offset = opts.calOffsetDb ?? 0;
		this.sourceLabel = opts.sourceLabel ?? "idle";
		this.timeZone = opts.timeZone ?? "UTC";
		this.installationIdSha256 = opts.installationIdSha256 ?? "";
		this.userAgent = opts.userAgent ?? "";
		this.modelLabel = opts.modelLabel ?? "browser";
		this.retune(this.fs);
		this.fftA = new FftAnalyzer(this.fftSize, .5);
		this.fftC = new FftAnalyzer(this.fftSize, .5);
		this.fftZ = new FftAnalyzer(this.fftSize, .5);
	}
	retune(fs) {
		this.fs = fs;
		this.a = designWeighting("A", fs);
		this.c = designWeighting("C", fs);
		this.z = designWeighting("Z", fs);
		this.fastA = new ExpMeanSquare("fast", fs);
		this.slowA = new ExpMeanSquare("slow", fs);
		this.fastC = new ExpMeanSquare("fast", fs);
		this.slowC = new ExpMeanSquare("slow", fs);
		this.fastZ = new ExpMeanSquare("fast", fs);
		this.leqA.reset();
		this.leqC.reset();
		this.peakA.reset();
		this.peakC.reset();
		this.sampleCursor = 0;
		this.nextRowAt = Math.round(fs / 8);
	}
	setIdentity(hash, userAgent, modelLabel, timeZone) {
		this.installationIdSha256 = hash;
		this.userAgent = userAgent;
		this.modelLabel = modelLabel;
		if (timeZone) this.timeZone = timeZone;
	}
	setCalibrationOffsetDb(offset) {
		const next = Math.max(-20, Math.min(20, offset));
		if (next === this.offset) return;
		this.offset = next;
		this.pushEvent("cal-change", `offset ${next.toFixed(1)} dB`);
	}
	resetPeakHold() {
		this.peakA.reset();
		this.peakC.reset();
	}
	setFftSize(size) {
		if (size === this.fftSize) return;
		this.fftSize = size;
		this.fftA = new FftAnalyzer(size, .5);
		this.fftC = new FftAnalyzer(size, .5);
		this.fftZ = new FftAnalyzer(size, .5);
		this.pendA.length = 0;
		this.pendC.length = 0;
		this.pendZ.length = 0;
	}
	setSpectrogramColor(color) {
		this.specColor = color;
	}
	setSourceMeta(mode, label, demoKind, deviceId) {
		const changed = mode !== this.mode || label !== this.sourceLabel || deviceId !== this.inputDeviceId;
		this.mode = mode;
		this.sourceLabel = label;
		this.demoKind = demoKind;
		this.inputDeviceId = deviceId;
		if (changed && this.sessionId) this.pushEvent("source-change", label);
	}
	setSampleRate(fs) {
		if (fs === this.fs) return;
		this.retune(fs);
		this.fftA.reset();
		this.fftC.reset();
		this.fftZ.reset();
	}
	subscribe(fn) {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
	emit() {
		if (this.listeners.size === 0) return;
		const frame = this.frame(this.nowStamp());
		const status = this.status();
		for (const fn of this.listeners) fn(frame, status);
	}
	status() {
		return {
			running: this.mode !== "idle",
			mode: this.mode,
			demoKind: this.demoKind,
			sourceLabel: this.sourceLabel,
			sampleRate: this.fs,
			calOffsetDb: this.offset,
			sessionId: this.sessionId,
			incidentId: this.incident?.id ?? null,
			incidentStartedEpochMs: this.incident?.startedAt.epochMs ?? null,
			baselineRemainingSec: this.baselineSamplesLeft > 0 ? this.baselineSamplesLeft / this.fs : 0,
			clippedLatch: this.clippedNow
		};
	}
	getSpectrum() {
		return this.spectrum;
	}
	getSpectrogram() {
		return {
			centers: ((this.specColor === "c" ? this.spectrum?.c : this.spectrum?.z) ?? []).map((b) => b.fc).filter((fc) => fc <= 2e3),
			columns: this.specColumns
		};
	}
	lastUiEmit = 0;
	/** Feed already-captured PCM. `epochMs` is the timestamp of the first sample. */
	pushSamples(samples, epochMs, monotonicMs) {
		const fs = this.fs;
		const a = this.a;
		const c = this.c;
		const zf = this.z;
		let clipped = false;
		const pendA = this.pendA;
		const pendC = this.pendC;
		const pendZ = this.pendZ;
		const rowEvery = Math.round(fs / 8);
		const logging = this.incident !== null;
		for (let i = 0; i < samples.length; i++) {
			const x = samples[i];
			if (Math.abs(x) >= .98) {
				clipped = true;
				this.clippedNow = true;
				this.clipLatchUntil = epochMs + (i + 1) / fs * 1e3 + 800;
			}
			const ya = tickCascade(a, x);
			const yc = tickCascade(c, x);
			const yz = tickCascade(zf, x);
			const msFa = this.fastA.push(ya);
			const msSa = this.slowA.push(ya);
			const msFc = this.fastC.push(yc);
			const msSc = this.slowC.push(yc);
			this.fastZ.push(yz);
			if (!(this.baselineSamplesLeft > 0)) {
				this.leqA.push(ya);
				this.leqC.push(yc);
				this.peakA.push(ya);
				this.peakC.push(yc);
				if (logging) {
					if (msFa > this.incFastAmax) this.incFastAmax = msFa;
					if (msSa > this.incSlowAmax) this.incSlowAmax = msSa;
					if (msFc > this.incFastCmax) this.incFastCmax = msFc;
					if (msSc > this.incSlowCmax) this.incSlowCmax = msSc;
					if (this.settled > fs * .2) {
						if (msFa < this.incFastAmin) this.incFastAmin = msFa;
						if (msFc < this.incFastCmin) this.incFastCmin = msFc;
					}
					if (Math.abs(ya) > this.incPeakA) this.incPeakA = Math.abs(ya);
					if (Math.abs(yc) > this.incPeakC) this.incPeakC = Math.abs(yc);
					this.settled++;
				}
			} else {
				this.baselineLeqA.push(ya);
				this.baselineLeqC.push(yc);
				this.baselineSamplesLeft--;
				if (this.baselineSamplesLeft === 0) this.finishBaseline(epochMs + i / fs * 1e3, monotonicMs + i / fs * 1e3);
			}
			pendA.push(ya);
			pendC.push(yc);
			pendZ.push(yz);
			this.sampleCursor++;
			if (logging && this.sampleCursor >= this.nextRowAt) {
				this.nextRowAt += rowEvery;
				const rowEpoch = epochMs + i / fs * 1e3;
				const row = this.frame(stampFrom(rowEpoch, monotonicMs + i / fs * 1e3, this.timeZone));
				if (row.clipped) this.incClipRows++;
				this.incident.samples.push(row);
				if (this.incident.samples.length > 115200) this.incident.samples.splice(0, rowEvery);
			}
		}
		if (clipped) {
			this.clipLatchUntil = epochMs + samples.length * (1e3 / fs) + 800;
			this.clippedNow = true;
		} else if (epochMs > this.clipLatchUntil) this.clippedNow = false;
		const flush = (buf, analyzer, which) => {
			if (buf.length < 256 && which !== "z") return;
			const block = new Float64Array(buf);
			buf.length = 0;
			analyzer.push(block, fs, (spec) => {
				if (which === "a") this.onHopA(spec.binMs, fs);
				else if (which === "c") this.onHopC(spec.binMs, fs);
				else this.onHopZ(spec.binMs, fs);
			});
		};
		const n = Math.min(pendA.length, pendC.length, pendZ.length);
		if (n >= 1024) {
			flush(pendA.splice(0, n), this.fftA, "a");
			flush(pendC.splice(0, n), this.fftC, "c");
			flush(pendZ.splice(0, n), this.fftZ, "z");
		}
		if (logging && this.incident && this.listeners.size === 0) {}
	}
	/** One demo/mic block at `epochMs` for the block start, then notify UI. */
	pumpBlock(samples, epochMs, monotonicMs) {
		this.pushSamples(samples, epochMs, monotonicMs);
		const endEpoch = epochMs + samples.length / this.fs * 1e3;
		const frame = this.frame(stampFrom(endEpoch, monotonicMs, this.timeZone));
		if (samples.length > 0 && endEpoch - this.lastUiEmit < 90) return frame;
		this.lastUiEmit = endEpoch;
		const status = this.status();
		for (const fn of this.listeners) fn(frame, status);
		return frame;
	}
	makeDemoBlock(kind) {
		const out = new Float32Array(BLOCK);
		const fs = this.fs;
		let p = this.demoPhase;
		for (let i = 0; i < BLOCK; i++) {
			const t = p / fs;
			if (kind === "tone1k") out[i] = .5 * Math.sin(2 * Math.PI * 1e3 * t);
			else if (kind === "bass") out[i] = .4 * Math.sin(2 * Math.PI * 55 * t) + .15 * Math.sin(2 * Math.PI * 110 * t) + .03 * Math.sin(2 * Math.PI * 1e3 * t);
			else {
				const n = (p * 1103515245 + 12345 & 2147483647) / 2147483647;
				out[i] = .03 * (n * 2 - 1) + .04 * Math.sin(2 * Math.PI * 187 * t);
			}
			p++;
		}
		this.demoPhase = p;
		return out;
	}
	onHopA(binMs, fs) {
		const bands = foldThirdOctave(binMs, fs, 0);
		if (!this.spectrum) this.spectrum = {
			binHz: fs / this.fftSize,
			fftSize: this.fftSize,
			a: bands.map((b) => ({
				...b,
				db: b.db + this.offset
			})),
			c: [],
			z: []
		};
		else {
			this.spectrum.a = bands.map((b) => ({
				...b,
				db: b.db + this.offset
			}));
			this.spectrum.binHz = fs / this.fftSize;
			this.spectrum.fftSize = this.fftSize;
		}
		if (this.incident) {
			if (this.incOctCenters.length === 0) this.incOctCenters = bands.map((b) => b.fc);
			if (this.incOctA.length !== bands.length) this.incOctA = emptyAcc(bands.length);
			for (let i = 0; i < bands.length; i++) {
				const ms = Math.pow(10, bands[i].db / 10);
				this.incOctA[i].sum += ms;
				this.incOctA[i].n += 1;
			}
		}
	}
	onHopC(binMs, fs) {
		const bands = foldThirdOctave(binMs, fs, 0);
		if (!this.spectrum) return;
		this.spectrum.c = bands.map((b) => ({
			...b,
			db: b.db + this.offset
		}));
		if (this.incident) {
			if (this.incOctC.length !== bands.length) this.incOctC = emptyAcc(bands.length);
			for (let i = 0; i < bands.length; i++) {
				const ms = Math.pow(10, bands[i].db / 10);
				this.incOctC[i].sum += ms;
				this.incOctC[i].n += 1;
			}
		}
	}
	onHopZ(binMs, fs) {
		const bands = foldThirdOctave(binMs, fs, 0, 2e3);
		if (this.spectrum) this.spectrum.z = bands.map((b) => ({
			...b,
			db: b.db + this.offset
		}));
		if (this.sampleCursor - this.specCursorMark < this.fs / 4) return;
		this.specCursorMark = this.sampleCursor;
		const col = (this.specColor === "c" && this.spectrum?.c.length ? this.spectrum.c : bands.map((b) => ({
			...b,
			db: b.db + this.offset
		}))).filter((b) => b.fc <= 2e3).map((b) => b.db);
		this.specColumns.push(col);
		const maxCols = 480;
		if (this.specColumns.length > maxCols) this.specColumns.splice(0, this.specColumns.length - maxCols);
	}
	frame(at) {
		const off = this.offset;
		const laf = dbFromMeanSquare(this.fastA.ms, off);
		const lcf = dbFromMeanSquare(this.fastC.ms, off);
		return {
			tEpochMs: at.epochMs,
			tIso: at.iso,
			tMonotonicMs: at.monotonicMs,
			timeZone: at.timeZone,
			laf,
			las: dbFromMeanSquare(this.slowA.ms, off),
			lcf,
			lcs: dbFromMeanSquare(this.slowC.ms, off),
			lzf: dbFromMeanSquare(this.fastZ.ms, off),
			laeq: dbFromMeanSquare(this.leqA.meanSquare, off),
			lceq: dbFromMeanSquare(this.leqC.meanSquare, off),
			lapeak: dbFromPeak(this.peakA.peak, off),
			lcpeak: dbFromPeak(this.peakC.peak, off),
			lcMinusLa: lcf - laf,
			clipped: this.clippedNow,
			sourceLabel: this.sourceLabel,
			calOffsetDb: off
		};
	}
	nowStamp() {
		return stampFrom(Date.now(), Date.now(), this.timeZone);
	}
	device() {
		return {
			installationIdSha256: this.installationIdSha256,
			userAgent: this.userAgent,
			modelLabel: this.modelLabel,
			sampleRate: this.fs,
			calOffsetDb: this.offset,
			sourceLabel: this.sourceLabel,
			sourceMode: this.mode,
			demoKind: this.demoKind,
			fftSize: this.fftSize,
			inputDeviceId: this.inputDeviceId,
			autoTime: "unknown-browser-clock",
			clockNote: "Browser clock. DecibelLog cannot read Settings.Global.AUTO_TIME. If this device clock is set manually, timestamps follow that clock."
		};
	}
	pushEvent(kind, detail) {
		const ev = {
			kind,
			at: this.nowStamp(),
			detail
		};
		this.sessionEvents.push(ev);
		if (this.incident) this.incident.events.push(ev);
	}
	startSession() {
		if (this.sessionId) return this.sessionId;
		this.sessionId = `ses_${Math.random().toString(36).slice(2, 10)}`;
		this.sessionEvents = [];
		this.leqA.reset();
		this.leqC.reset();
		this.peakA.reset();
		this.peakC.reset();
		this.pushEvent("session-start", this.sourceLabel);
		this.emit();
		return this.sessionId;
	}
	stopSession() {
		if (this.incident) this.stopIncident();
		if (!this.sessionId) return;
		this.pushEvent("session-stop", "stopped");
		this.sessionId = null;
		this.emit();
	}
	startIncident(meta, location = null, levelsOnly = true) {
		if (!this.sessionId) this.startSession();
		if (this.incident) this.stopIncident();
		const id = `inc_${Math.random().toString(36).slice(2, 10)}`;
		this.incFastAmax = 0;
		this.incSlowAmax = 0;
		this.incFastCmax = 0;
		this.incSlowCmax = 0;
		this.incFastAmin = Infinity;
		this.incFastCmin = Infinity;
		this.incPeakA = 0;
		this.incPeakC = 0;
		this.incClipRows = 0;
		this.incOctA = [];
		this.incOctC = [];
		this.incOctCenters = [];
		this.settled = 0;
		this.nextRowAt = this.sampleCursor + Math.round(this.fs / 8);
		this.leqA.reset();
		this.leqC.reset();
		this.peakA.reset();
		this.peakC.reset();
		const started = this.nowStamp();
		this.incident = {
			id,
			sessionId: this.sessionId,
			meta: { ...meta },
			startedAt: started,
			endedAt: null,
			summary: null,
			samples: [],
			baseline: null,
			events: [...this.sessionEvents],
			device: this.device(),
			location,
			levelsOnly
		};
		this.pushEvent("incident-start", meta.noiseType);
		this.emit();
		return this.incident;
	}
	stopIncident() {
		const inc = this.incident;
		if (!inc) return this.lastIncident;
		const ended = this.nowStamp();
		inc.endedAt = ended;
		inc.device = this.device();
		const off = this.offset;
		const durationSec = Math.max(0, (ended.epochMs - inc.startedAt.epochMs) / 1e3);
		inc.summary = {
			durationSec,
			laeq: dbFromMeanSquare(this.leqA.meanSquare, off),
			lceq: dbFromMeanSquare(this.leqC.meanSquare, off),
			lafMax: dbFromMeanSquare(this.incFastAmax, off),
			lcfMax: dbFromMeanSquare(this.incFastCmax, off),
			lasMax: dbFromMeanSquare(this.incSlowAmax, off),
			lcsMax: dbFromMeanSquare(this.incSlowCmax, off),
			lafMin: Number.isFinite(this.incFastAmin) ? dbFromMeanSquare(this.incFastAmin, off) : dbFromMeanSquare(0, off),
			lcfMin: Number.isFinite(this.incFastCmin) ? dbFromMeanSquare(this.incFastCmin, off) : dbFromMeanSquare(0, off),
			laPeak: dbFromPeak(this.incPeakA, off),
			lcPeak: dbFromPeak(this.incPeakC, off),
			lcMinusLa: dbFromMeanSquare(this.leqC.meanSquare, 0) - dbFromMeanSquare(this.leqA.meanSquare, 0),
			clippedRows: this.incClipRows,
			octave: {
				a: accToBands(this.incOctCenters, this.incOctA, off),
				c: accToBands(this.incOctCenters, this.incOctC, off)
			}
		};
		this.pushEvent("incident-end", `${durationSec.toFixed(1)} s`);
		this.incident = null;
		this.lastIncident = inc;
		this.emit();
		return inc;
	}
	captureBaseline(seconds = 45) {
		if (!(this.incident ?? this.lastIncident)) return;
		this.baselineTargetSec = seconds;
		this.baselineSamplesLeft = Math.round(seconds * this.fs);
		this.baselineLeqA.reset();
		this.baselineLeqC.reset();
		this.baselineStarted = this.nowStamp();
		this.pushEvent("baseline-start", `${seconds}s`);
		this.emit();
	}
	finishBaseline(epochMs, monotonicMs) {
		const target = this.incident ?? this.lastIncident;
		const started = this.baselineStarted;
		if (!target || !started) return;
		const ended = stampFrom(epochMs, monotonicMs, this.timeZone);
		target.baseline = {
			seconds: this.baselineTargetSec,
			startedAt: started,
			endedAt: ended,
			laeq: dbFromMeanSquare(this.baselineLeqA.meanSquare, this.offset),
			lceq: dbFromMeanSquare(this.baselineLeqC.meanSquare, this.offset)
		};
		const ev = {
			kind: "baseline-end",
			at: ended,
			detail: `LAeq ${target.baseline.laeq.toFixed(1)}`
		};
		this.sessionEvents.push(ev);
		target.events.push(ev);
		this.emit();
	}
	noteDropout(gapMs) {
		if (this.sessionId) this.pushEvent("dropout", `${Math.round(gapMs)} ms gap`);
	}
	get activeIncident() {
		return this.incident;
	}
	get recentIncident() {
		return this.lastIncident ?? this.incident;
	}
};
var engine = null;
var demoTimer = null;
var audioCtx = null;
var micStream = null;
var lastTick = 0;
var retainAudio = false;
var wavChunks = [];
var wavCount = 0;
var wavCapped = false;
function getEngine() {
	if (!engine) engine = new SoundLevelEngine({
		sampleRate: 48e3,
		fftSize: 4096,
		timeZone: (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC") || "UTC",
		modelLabel: "browser"
	});
	return engine;
}
async function installationHash() {
	const key = "decibellog-install";
	let id = localStorage.getItem(key);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(key, id);
	}
	return sha256Hex(new TextEncoder().encode(id));
}
async function bootEngine(opts) {
	const eng = getEngine();
	const hash = await installationHash();
	eng.setIdentity(hash, navigator.userAgent, "browser", Intl.DateTimeFormat().resolvedOptions().timeZone);
	eng.setCalibrationOffsetDb(opts.calOffsetDb);
	eng.setFftSize(opts.fftSize);
	eng.setSpectrogramColor(opts.specColor);
}
function setRetainAudio(on) {
	retainAudio = on;
	if (!on) clearWav();
}
function wasWavCapped() {
	return wavCapped;
}
function clearWav() {
	wavChunks.length = 0;
	wavCount = 0;
	wavCapped = false;
}
var wavBlobs = /* @__PURE__ */ new Map();
function rememberWav(id, wav) {
	if (wav && wav.length > 44) wavBlobs.set(id, wav);
}
function recallWav(id) {
	return wavBlobs.get(id) ?? null;
}
function takeWav() {
	if (wavCount === 0) return null;
	const out = new Float32Array(wavCount);
	let o = 0;
	for (const chunk of wavChunks) {
		out.set(chunk, o);
		o += chunk.length;
	}
	clearWav();
	return out;
}
function keepWav(samples, sampleRate, incidentId) {
	if (!retainAudio || !incidentId) return;
	const cap = sampleRate * 60;
	if (wavCount >= cap) {
		wavCapped = true;
		return;
	}
	const n = Math.min(samples.length, cap - wavCount);
	wavChunks.push(samples.slice(0, n));
	wavCount += n;
	if (wavCount >= cap) wavCapped = true;
}
function stopDemoTimer() {
	if (demoTimer) {
		clearInterval(demoTimer);
		demoTimer = null;
	}
}
async function stopMic() {
	micStream?.getTracks().forEach((t) => t.stop());
	micStream = null;
	if (audioCtx) {
		await audioCtx.close().catch(() => void 0);
		audioCtx = null;
	}
}
function startDemo(kind) {
	stopMic();
	stopDemoTimer();
	const eng = getEngine();
	eng.setSampleRate(48e3);
	const label = kind === "bass" ? "Demo · bass-heavy" : kind === "tone1k" ? "Demo · 1 kHz tone" : "Demo · room noise";
	eng.setSourceMeta("demo", label, kind, null);
	lastTick = performance.now();
	demoTimer = setInterval(() => {
		const now = performance.now();
		const gap = now - lastTick;
		if (gap > 200) eng.noteDropout(gap);
		lastTick = now;
		const block = eng.makeDemoBlock(kind);
		const statusBefore = eng.status().incidentId;
		eng.pumpBlock(block, Date.now(), performance.timeOrigin + now);
		keepWav(block, 48e3, statusBefore);
	}, 40);
}
async function startMic(deviceId) {
	stopDemoTimer();
	await stopMic();
	const eng = getEngine();
	if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser has no microphone API.");
	const base = {
		echoCancellation: false,
		noiseSuppression: false,
		autoGainControl: false,
		channelCount: 1
	};
	if (deviceId) base.deviceId = { exact: deviceId };
	let stream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: base });
	} catch {
		stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
	}
	micStream = stream;
	const Ctx = window.AudioContext || window.webkitAudioContext;
	if (!Ctx) throw new Error("AudioContext is missing.");
	const ctx = new Ctx({ sampleRate: 48e3 });
	audioCtx = ctx;
	if (ctx.state === "suspended") await ctx.resume();
	await ctx.audioWorklet.addModule("/capture-worklet.js");
	const track = stream.getAudioTracks()[0];
	const settings = track?.getSettings() ?? {};
	const rate = ctx.sampleRate || 48e3;
	eng.setSampleRate(rate);
	const label = track?.label || "Microphone";
	const id = settings.deviceId ?? deviceId;
	eng.setSourceMeta("mic", label, null, id ?? null);
	const source = ctx.createMediaStreamSource(stream);
	const node = new AudioWorkletNode(ctx, "capture-processor");
	lastTick = performance.now();
	node.port.onmessage = (event) => {
		const now = performance.now();
		const gap = now - lastTick;
		if (gap > 180) eng.noteDropout(gap);
		lastTick = now;
		const samples = event.data;
		const incidentId = eng.status().incidentId;
		eng.pumpBlock(samples, Date.now(), performance.timeOrigin + now);
		keepWav(samples, rate, incidentId);
	};
	const mute = ctx.createGain();
	mute.gain.value = 0;
	source.connect(node);
	node.connect(mute);
	mute.connect(ctx.destination);
	return label;
}
async function listInputs() {
	if (!navigator.mediaDevices?.enumerateDevices) return [];
	return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput").map((d, i) => ({
		id: d.deviceId,
		label: d.label || `Microphone ${i + 1}`
	}));
}
function burstFullScale() {
	const eng = getEngine();
	const fs = eng.status().sampleRate || 48e3;
	const n = Math.round(fs * .2);
	const block = new Float32Array(n);
	for (let i = 0; i < n; i++) block[i] = Math.sin(2 * Math.PI * 1e3 * i / fs);
	eng.pumpBlock(block, Date.now(), performance.timeOrigin + performance.now());
}
function estimateHours(fftSize, saveWav, screenOn) {
	let mA = screenOn ? 230 : 95;
	if (fftSize >= 8192) mA += screenOn ? 35 : 20;
	if (fftSize >= 16384) mA += 40;
	if (saveWav) mA += 25;
	return 4700 / mA;
}
function slim(list) {
	return list.slice(0, 24).map((inc, index) => ({
		...inc,
		samples: index < 3 ? inc.samples.slice(-4800) : []
	}));
}
var useLogbook = create()(persist((set) => ({
	calByDevice: { demo: 0 },
	deviceKey: "demo",
	fftSize: 4096,
	levelsOnly: true,
	stampLocation: false,
	spectroSeconds: 60,
	specColor: "c",
	demoKind: "bass",
	screenOnEstimate: true,
	incidents: [],
	setCal: (key, offset) => set((s) => ({ calByDevice: {
		...s.calByDevice,
		[key]: Math.max(-20, Math.min(20, offset))
	} })),
	patch: (partial) => set(partial),
	saveIncident: (inc) => set((s) => ({ incidents: slim([inc, ...s.incidents.filter((row) => row.id !== inc.id)]) })),
	removeIncident: (id) => set((s) => ({ incidents: s.incidents.filter((row) => row.id !== id) }))
}), { name: "decibellog-v1" }));
var DISCLAIMER = "DecibelLog is not a certified sound level meter and does not claim IEC 61672 Class 1 or Class 2 accuracy. The weighting filters follow the IEC analog prototypes via the bilinear transform and are gain-normalized at 1 kHz, but this phone or browser path is uncalibrated unless you enter your own offset. Use readings comparatively (quiet versus loud in this room), not as a legal certification. Timestamps follow this device clock and are never rewritten. This tool does not transcribe speech, beamform toward a neighbor, or edit evidence audio. LEVELS_ONLY packs contain meters and spectrum, not a recording.";
var APP_VERSION = "1.0.0-web";
var SDK_VERSION = "1.0.0";
var METER_HEADER = [
	"t_epoch_ms",
	"t_monotonic_ms",
	"t_iso",
	"timezone",
	"laf",
	"las",
	"lcf",
	"lcs",
	"lzf",
	"lapeak_hold",
	"lcpeak_hold",
	"laeq",
	"lceq",
	"lc_minus_la",
	"clipped",
	"cal_offset_db",
	"source"
];
function num(n) {
	return Number.isFinite(n) ? n.toFixed(3) : "";
}
function cell(value) {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, "\"\"")}"`;
	return value;
}
function renderMetersCsv(rows) {
	const lines = [METER_HEADER.join(",")];
	for (const row of rows) lines.push([
		String(Math.round(row.tEpochMs)),
		String(Math.round(row.tMonotonicMs)),
		row.tIso,
		row.timeZone,
		num(row.laf),
		num(row.las),
		num(row.lcf),
		num(row.lcs),
		num(row.lzf),
		num(row.lapeak),
		num(row.lcpeak),
		num(row.laeq),
		num(row.lceq),
		num(row.lcMinusLa),
		row.clipped ? "1" : "0",
		num(row.calOffsetDb),
		cell(row.sourceLabel)
	].join(","));
	return lines.join("\n") + "\n";
}
/** Tiny single-font PDF writer. Text is ASCII; the disclaimer is wrapped, not typeset. */
function ascii(text) {
	return text.replaceAll("−", "-").replaceAll("–", "-").replaceAll("—", "-").replace(/[^\x20-\x7E\n]/g, "?");
}
function wrapText(text, width = 88) {
	const out = [];
	for (const raw of ascii(text).split("\n")) {
		const words = raw.split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			out.push("");
			continue;
		}
		let line = "";
		for (const word of words) {
			const next = line ? `${line} ${word}` : word;
			if (next.length > width && line) {
				out.push(line);
				line = word;
			} else line = next;
		}
		if (line) out.push(line);
	}
	return out;
}
function pdfEscape(text) {
	return ascii(text).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
function renderTextPdf(title, body) {
	const lines = [
		title,
		"",
		...wrapText(body)
	];
	const commands = [
		"BT",
		"/F1 11 Tf",
		"14 TL",
		"48 760 Td"
	];
	let used = 0;
	for (const line of lines) {
		if (used === 0) commands.push(`/F1 14 Tf (${pdfEscape(line)}) Tj`);
		else commands.push(`/F1 10 Tf (${pdfEscape(line)}) Tj`);
		commands.push("T*");
		used++;
		if (used > 62) break;
	}
	commands.push("ET");
	const stream = commands.join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
	];
	let pdf = "%PDF-1.4\n";
	const offsets = [0];
	for (let i = 0; i < objects.length; i++) {
		offsets.push(pdf.length);
		pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
	}
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += "0000000000 65535 f \n";
	for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
	pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return new TextEncoder().encode(pdf);
}
var CRC_TABLE = (() => {
	const table = /* @__PURE__ */ new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();
function crc32(data) {
	let c = 4294967295;
	for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 255] ^ c >>> 8;
	return (c ^ 4294967295) >>> 0;
}
function dosTime(date) {
	return {
		time: (date.getHours() & 31) << 11 | (date.getMinutes() & 63) << 5 | date.getSeconds() >> 1 & 31,
		day: (date.getFullYear() - 1980 & 127) << 9 | (date.getMonth() + 1 & 15) << 5 | date.getDate() & 31
	};
}
function zipStore(entries, when = /* @__PURE__ */ new Date()) {
	const { time, day } = dosTime(when);
	const enc = new TextEncoder();
	const names = entries.map((e) => enc.encode(e.name));
	const crcs = entries.map((e) => crc32(e.data));
	let localTotal = 0;
	let centralTotal = 0;
	for (let i = 0; i < entries.length; i++) {
		localTotal += 30 + names[i].length + entries[i].data.length;
		centralTotal += 46 + names[i].length;
	}
	const out = new Uint8Array(localTotal + centralTotal + 22);
	const view = new DataView(out.buffer);
	let p = 0;
	const offsets = [];
	for (let i = 0; i < entries.length; i++) {
		offsets.push(p);
		const name = names[i];
		const data = entries[i].data;
		view.setUint32(p, 67324752, true);
		view.setUint16(p + 4, 20, true);
		view.setUint16(p + 6, 0, true);
		view.setUint16(p + 8, 0, true);
		view.setUint16(p + 10, time, true);
		view.setUint16(p + 12, day, true);
		view.setUint32(p + 14, crcs[i], true);
		view.setUint32(p + 18, data.length, true);
		view.setUint32(p + 22, data.length, true);
		view.setUint16(p + 26, name.length, true);
		view.setUint16(p + 28, 0, true);
		p += 30;
		out.set(name, p);
		p += name.length;
		out.set(data, p);
		p += data.length;
	}
	const centralStart = p;
	for (let i = 0; i < entries.length; i++) {
		const name = names[i];
		const data = entries[i].data;
		view.setUint32(p, 33639248, true);
		view.setUint16(p + 4, 20, true);
		view.setUint16(p + 6, 20, true);
		view.setUint16(p + 8, 0, true);
		view.setUint16(p + 10, 0, true);
		view.setUint16(p + 12, time, true);
		view.setUint16(p + 14, day, true);
		view.setUint32(p + 16, crcs[i], true);
		view.setUint32(p + 20, data.length, true);
		view.setUint32(p + 24, data.length, true);
		view.setUint16(p + 28, name.length, true);
		view.setUint16(p + 30, 0, true);
		view.setUint16(p + 32, 0, true);
		view.setUint16(p + 34, 0, true);
		view.setUint16(p + 36, 0, true);
		view.setUint32(p + 38, 0, true);
		view.setUint32(p + 42, offsets[i], true);
		p += 46;
		out.set(name, p);
		p += name.length;
	}
	view.setUint32(p, 101010256, true);
	view.setUint16(p + 4, 0, true);
	view.setUint16(p + 6, 0, true);
	view.setUint16(p + 8, entries.length, true);
	view.setUint16(p + 10, entries.length, true);
	view.setUint32(p + 12, p - centralStart, true);
	view.setUint32(p + 16, centralStart, true);
	view.setUint16(p + 20, 0, true);
	return out;
}
var SESSION_SCHEMA_ID = "https://decibellog.local/schema/session-v1.json";
function n(v) {
	return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v;
}
function sessionDocument(inc) {
	return {
		schema: "decibellog.session/v1",
		$schema: SESSION_SCHEMA_ID,
		appVersion: APP_VERSION,
		sdkVersion: SDK_VERSION,
		sessionId: inc.sessionId,
		incidentId: inc.id,
		levelsOnly: inc.levelsOnly,
		startedAt: inc.startedAt,
		endedAt: inc.endedAt,
		meta: inc.meta,
		device: inc.device,
		location: inc.location,
		summary: inc.summary ? {
			...inc.summary,
			laeq: n(inc.summary.laeq),
			lceq: n(inc.summary.lceq),
			lcMinusLa: n(inc.summary.lcMinusLa)
		} : null,
		baseline: inc.baseline,
		events: inc.events,
		sampleCount: inc.samples.length,
		disclaimer: DISCLAIMER
	};
}
function slateText(inc) {
	const m = inc.meta;
	return [
		`DecibelLog slate`,
		`incident: ${inc.id}`,
		`session: ${inc.sessionId}`,
		`name: ${m.name || "(not given)"}`,
		`address: ${m.address || "(not given)"}`,
		`room: ${m.room || "(not given)"}`,
		`windows: ${m.windows}`,
		`perceived direction: ${m.direction}`,
		`noise type: ${m.noiseType}`,
		`note: ${m.note || ""}`,
		`started: ${inc.startedAt.iso} ${inc.startedAt.timeZone}`,
		`ended: ${inc.endedAt?.iso ?? "(open)"}`,
		``,
		DISCLAIMER,
		``
	].join("\n");
}
function reportBody(inc) {
	const s = inc.summary;
	const lines = [
		`Incident ${inc.id}`,
		`Session ${inc.sessionId}`,
		`${inc.meta.room || "room"} · ${inc.meta.noiseType} · windows ${inc.meta.windows}`,
		`Address: ${inc.meta.address || "(not given)"}`,
		`Name: ${inc.meta.name || "(not given)"}`,
		`Direction (perceived, not measured): ${inc.meta.direction}`,
		`Start ${inc.startedAt.iso} (${inc.startedAt.timeZone})`,
		`End ${inc.endedAt?.iso ?? "open"}`,
		`Source ${inc.device.sourceLabel} @ ${inc.device.sampleRate} Hz`,
		`Calibration offset ${inc.device.calOffsetDb.toFixed(1)} dB`,
		`Clock: ${inc.device.clockNote}`,
		`Install ${inc.device.installationIdSha256.slice(0, 16) || "(none)"}`,
		""
	];
	if (s) {
		lines.push(`Duration ${s.durationSec.toFixed(1)} s`, `LAeq ${s.laeq.toFixed(1)}   LCeq ${s.lceq.toFixed(1)}   LC-LA ${s.lcMinusLa.toFixed(1)}`, `LAmax,F ${s.lafMax.toFixed(1)}   LCmax,F ${s.lcfMax.toFixed(1)}`, `LASmax ${s.lasMax.toFixed(1)}   LCSmax ${s.lcsMax.toFixed(1)}`, `LAFmin ${s.lafMin.toFixed(1)}   LCpeak ${s.lcPeak.toFixed(1)}`, `Clipped meter rows ${s.clippedRows}`, "", "1/3-octave Leq (FFT-binned, low bands limited by bin width):");
		const cs = s.octave.c;
		for (const band of s.octave.a) {
			const c = cs.find((x) => x.fc === band.fc);
			lines.push(`${band.fc} Hz   A ${band.db.toFixed(1)}   C ${c ? c.db.toFixed(1) : "--"}`);
		}
	} else lines.push("Incident is still open. Summary is written when it ends.");
	if (inc.baseline) lines.push("", `Quiet baseline ${inc.baseline.seconds}s  LAeq ${inc.baseline.laeq.toFixed(1)}  LCeq ${inc.baseline.lceq.toFixed(1)}`);
	if (inc.location) lines.push(`Location ${inc.location.lat.toFixed(5)}, ${inc.location.lon.toFixed(5)} ±${Math.round(inc.location.accuracyM)} m`);
	lines.push("", "FOOTER", DISCLAIMER);
	return lines.join("\n");
}
function packBaseName(inc) {
	return `${fileStamp(new Date(inc.startedAt.epochMs))}_${slugPart(inc.meta.room, "room")}_${slugPart(inc.meta.noiseType, "noise")}`;
}
async function buildEvidencePack(inc, wav) {
	const base = packBaseName(inc);
	const enc = new TextEncoder();
	const csv = enc.encode(renderMetersCsv(inc.samples));
	const session = enc.encode(JSON.stringify(sessionDocument(inc), null, 2) + "\n");
	const slate = enc.encode(slateText(inc));
	const pdf = renderTextPdf(`DecibelLog ${base}`, reportBody(inc));
	const files = [
		{
			name: `${base}_slate.txt`,
			data: slate
		},
		{
			name: `${base}_meters.csv`,
			data: csv
		},
		{
			name: `${base}_session.json`,
			data: session
		},
		{
			name: `${base}_report.pdf`,
			data: pdf
		}
	];
	if (wav && wav.length > 44) files.push({
		name: `${base}_audio.wav`,
		data: wav
	});
	const hashes = await Promise.all(files.map(async (f) => `${await sha256Hex(f.data)}  ${f.name}`));
	files.push({
		name: `${base}_hashes.sha256`,
		data: enc.encode(hashes.join("\n") + "\n")
	});
	const bytes = zipStore(files, new Date(inc.startedAt.epochMs));
	return {
		filename: `${base}_pack.zip`,
		bytes
	};
}
function encodeWav16(samples, sampleRate) {
	const n = samples.length;
	const buffer = /* @__PURE__ */ new ArrayBuffer(44 + n * 2);
	const view = new DataView(buffer);
	const str = (offset, value) => {
		for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
	};
	str(0, "RIFF");
	view.setUint32(4, 36 + n * 2, true);
	str(8, "WAVE");
	str(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	str(36, "data");
	view.setUint32(40, n * 2, true);
	let offset = 44;
	for (let i = 0; i < n; i++) {
		const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
		view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
		offset += 2;
	}
	return new Uint8Array(buffer);
}
function fmtDb(n) {
	if (n === void 0 || n === null || !Number.isFinite(n) || n < -160) return "—";
	return n.toFixed(1);
}
function fmtDur(sec) {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor(s % 3600 / 60);
	const r = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
	return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function downloadBytes(filename, bytes, mime) {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	const blob = new Blob([copy], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function levelPct(db, offset) {
	const lo = offset - 70;
	const hi = offset + 3;
	if (!Number.isFinite(db)) return 0;
	return Math.max(0, Math.min(1, (db - lo) / (hi - lo)));
}
async function locate() {
	if (!navigator.geolocation) return null;
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition((pos) => resolve({
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
			accuracyM: pos.coords.accuracy
		}), () => resolve(null), {
			enableHighAccuracy: true,
			timeout: 8e3,
			maximumAge: 6e4
		});
	});
}
async function beginIncident(meta) {
	const settings = useLogbook.getState();
	const eng = getEngine();
	if (settings.levelsOnly) {
		setRetainAudio(false);
		clearWav();
	} else {
		clearWav();
		setRetainAudio(true);
	}
	const location = settings.stampLocation ? await locate() : null;
	eng.startIncident(meta, location, settings.levelsOnly);
}
function endIncident() {
	const inc = getEngine().stopIncident();
	if (!inc) return null;
	if (!inc.levelsOnly) {
		const capped = wasWavCapped();
		const pcm = takeWav();
		if (pcm) rememberWav(inc.id, encodeWav16(pcm, inc.device.sampleRate || 48e3));
		if (capped) inc.events.push({
			kind: "incident-end",
			at: inc.endedAt ?? inc.startedAt,
			detail: "audio capped at 60 s"
		});
	} else clearWav();
	useLogbook.getState().saveIncident(structuredClone(inc));
	return inc;
}
async function downloadIncident(inc) {
	const pack = await buildEvidencePack(inc, recallWav(inc.id));
	downloadBytes(pack.filename, pack.bytes, "application/zip");
}
async function copySummary(inc) {
	const text = reportBody(inc);
	if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
}
function xOf(freq) {
	const min = Math.log10(20);
	const max = Math.log10(2e4);
	return (Math.log10(Math.min(2e4, Math.max(20, freq))) - min) / (max - min) * 640;
}
function yOf(db, lo, hi) {
	const t = (db - lo) / (hi - lo || 1);
	return 250 - Math.max(0, Math.min(1, t)) * 230;
}
function poly(bands, lo, hi) {
	return bands.filter((b) => b.fc >= 20 && b.fc <= 2e4).map((b, i) => `${i === 0 ? "M" : "L"}${xOf(b.fc).toFixed(1)} ${yOf(b.db, lo, hi).toFixed(1)}`).join(" ");
}
var GRID_HZ = [
	20,
	50,
	100,
	200,
	500,
	1e3,
	2e3,
	5e3,
	1e4,
	2e4
];
function SpectrumPanel() {
	const [frame, setFrame] = (0, import_react.useState)(null);
	const [hold, setHold] = (0, import_react.useState)(true);
	const peakA = (0, import_react.useRef)([]);
	const peakC = (0, import_react.useRef)([]);
	const offset = useLogbook((s) => s.calByDevice[s.deviceKey] ?? 0);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			const next = getEngine().getSpectrum();
			if (!next) return;
			setFrame(next);
			const grow = (dst, src) => {
				for (let i = 0; i < src.length; i++) dst[i] = Math.max(dst[i] ?? -200, src[i].db);
			};
			if (hold) {
				grow(peakA.current, next.a);
				grow(peakC.current, next.c);
			}
		}, 200);
		return () => window.clearInterval(id);
	}, [hold]);
	const lo = offset - 80;
	const hi = offset + 6;
	const a = frame?.a ?? [];
	const c = frame?.c ?? [];
	const peakPathA = peakA.current.length ? poly(a.map((b, i) => ({
		fc: b.fc,
		db: peakA.current[i] ?? b.db
	})), lo, hi) : "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col gap-4 p-4 lg:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-medium",
					children: "Spectrum"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-mist",
					children: ["1/3-octave, log frequency. A is phosphor, C is the pale trace. Low bands are limited by FFT bin width", frame ? ` (${frame.fftSize}, ${frame.binHz.toFixed(2)} Hz).` : "."]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-11 shrink-0 rounded-full border border-line px-4 text-sm",
					onClick: () => {
						peakA.current = [];
						peakC.current = [];
						setHold(true);
					},
					children: "Reset peak"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-line bg-surface p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 640 270",
					className: "h-64 w-full text-mist",
					role: "img",
					"aria-label": "A and C weighted third-octave spectrum",
					children: [
						GRID_HZ.map((hz) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
							x1: xOf(hz),
							x2: xOf(hz),
							y1: "16",
							y2: "250",
							stroke: "currentColor",
							strokeOpacity: "0.25"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
							x: xOf(hz),
							y: "266",
							textAnchor: "middle",
							fill: "currentColor",
							fontSize: "11",
							children: hz >= 1e3 ? `${hz / 1e3}k` : hz
						})] }, hz)),
						[
							0,
							.5,
							1
						].map((t) => {
							const db = lo + (hi - lo) * t;
							const y = yOf(db, lo, hi);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
								x1: "0",
								x2: "640",
								y1: y,
								y2: y,
								stroke: "currentColor",
								strokeOpacity: "0.25"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
								x: "4",
								y: y - 4,
								fill: "currentColor",
								fontSize: "11",
								children: db.toFixed(0)
							})] }, t);
						}),
						peakPathA ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
							d: peakPathA,
							fill: "none",
							stroke: "currentColor",
							strokeOpacity: "0.45",
							strokeDasharray: "3 4",
							strokeWidth: "1.25"
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
							d: poly(c, lo, hi),
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.75",
							className: "text-fg"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
							d: poly(a, lo, hi),
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2.25",
							className: "text-phosphor"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex gap-4 text-xs text-mist",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-phosphor",
							children: "A-weighted"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "C-weighted"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dashed · peak hold" })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mist",
				children: "A bass-heavy demo should sit higher on the C trace below a few hundred hertz. That gap is LC−LA, not a source direction."
			})
		]
	});
}
function SpectrogramPanel() {
	const seconds = useLogbook((s) => s.spectroSeconds);
	const color = useLogbook((s) => s.specColor);
	const [cols, setCols] = (0, import_react.useState)([]);
	const [centers, setCenters] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		getEngine().setSpectrogramColor(color);
	}, [color]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			const gram = getEngine().getSpectrogram();
			setCenters(gram.centers);
			setCols(gram.columns.slice(-seconds * 4));
		}, 250);
		return () => window.clearInterval(id);
	}, [seconds]);
	const picture = (0, import_react.useMemo)(() => drawGram(cols), [cols]);
	const labels = centers.filter((_, i) => i % 3 === 0).slice().reverse();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col gap-4 p-4 lg:p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-lg font-medium",
			children: "Spectrogram"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-mist",
			children: [
				"Last ",
				seconds,
				"s, 25 Hz–2 kHz, color is ",
				color === "c" ? "dBC" : "dBZ",
				". Brighter is louder. Meant for bass, not for reading speech."
			]
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-line bg-surface p-3",
			children: [cols.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "flex h-56 items-center justify-center text-sm text-mist",
				children: "Waiting for the first FFT window."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-56 w-10 flex-col justify-between py-1 text-right text-xs text-mist",
					children: labels.slice(0, 6).map((fc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: fc >= 1e3 ? `${fc / 1e3}k` : Math.round(fc) }, fc))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 640 240",
					className: "h-56 w-full text-phosphor",
					role: "img",
					"aria-label": "Low-frequency spectrogram",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { dangerouslySetInnerHTML: { __html: picture } })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center gap-3 text-xs text-mist",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "quiet" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "h-2 flex-1 rounded-full bg-surface-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "block h-2 w-full rounded-full bg-phosphor opacity-80" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "loud" })
				]
			})]
		})]
	});
}
function drawGram(cols) {
	if (cols.length === 0) return "";
	let maxDb = -160;
	for (const col of cols) for (const v of col) if (v > maxDb) maxDb = v;
	const floor = maxDb - 48;
	const cw = 640 / cols.length;
	const parts = [];
	for (let x = 0; x < cols.length; x++) {
		const col = cols[x];
		const bh = 240 / Math.max(col.length, 1);
		for (let y = 0; y < col.length; y++) {
			const t = Math.max(0, Math.min(1, ((col[y] ?? floor) - floor) / 48));
			if (t < .05) continue;
			const yy = 240 - (y + 1) * bh;
			parts.push(`<rect x="${(x * cw).toFixed(2)}" y="${yy.toFixed(2)}" width="${(cw + .35).toFixed(2)}" height="${(bh + .35).toFixed(2)}" fill="currentColor" opacity="${t.toFixed(2)}"/>`);
		}
	}
	return parts.join("");
}
function LogbookPanel() {
	const incidents = useLogbook((s) => s.incidents);
	const remove = useLogbook((s) => s.removeIncident);
	const [day, setDay] = (0, import_react.useState)("");
	const [pendingDelete, setPendingDelete] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const shown = incidents.filter((inc) => {
		if (!day) return true;
		const local = new Date(inc.startedAt.epochMs);
		return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}` === day;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col gap-4 p-4 lg:p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-medium",
				children: "Logbook"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mist",
				children: "Newest three incidents keep meter rows. Older ones keep the summary only."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex flex-col gap-1 text-xs text-mist",
				children: ["Date", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "date",
					value: day,
					onChange: (e) => setDay(e.target.value),
					className: "h-11 rounded-xl border border-line bg-surface px-3 text-base text-fg"
				})]
			})]
		}), shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-mist",
			children: "No incidents yet. Start a session, then mark an incident while the noise is happening."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "flex flex-col gap-3",
			children: shown.map((inc) => {
				const s = inc.summary;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-2xl border border-line bg-surface p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "font-medium",
								children: [
									inc.meta.room || "Room",
									" · ",
									inc.meta.noiseType
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "nums text-sm text-mist",
								children: inc.startedAt.iso
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-mist",
							children: [
								inc.meta.address || "No address",
								" · windows ",
								inc.meta.windows,
								" · ",
								inc.meta.direction
							]
						}),
						s ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "nums mt-3 text-sm",
							children: [
								fmtDur(s.durationSec),
								" · LAeq ",
								fmtDb(s.laeq),
								" · LCeq ",
								fmtDb(s.lceq),
								" · LC−LA ",
								fmtDb(s.lcMinusLa)
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-mist",
							children: "No summary."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-11 rounded-full bg-phosphor px-4 text-sm font-medium text-bg disabled:opacity-50",
									disabled: busy === inc.id,
									onClick: () => {
										setBusy(inc.id);
										downloadIncident(inc).finally(() => setBusy(null));
									},
									children: busy === inc.id ? "Packing…" : "Export pack"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-11 rounded-full border border-line px-4 text-sm",
									onClick: () => void copySummary(inc).catch(() => void 0),
									children: "Copy summary"
								}),
								pendingDelete === inc.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-11 rounded-full bg-alarm px-4 text-sm font-medium text-bg",
									onClick: () => {
										remove(inc.id);
										setPendingDelete(null);
									},
									children: "Confirm delete"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-11 rounded-full border border-line px-4 text-sm",
									onClick: () => setPendingDelete(inc.id),
									children: "Delete"
								})
							]
						})
					]
				}, inc.id);
			})
		})]
	});
}
function SettingsPanel() {
	const state = useLogbook();
	const cal = state.calByDevice[state.deviceKey] ?? 0;
	const [devices, setDevices] = (0, import_react.useState)([]);
	const [refDb, setRefDb] = (0, import_react.useState)("");
	const [micError, setMicError] = (0, import_react.useState)(null);
	const [liveLaf, setLiveLaf] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		return getEngine().subscribe((frame) => setLiveLaf(frame.laf));
	}, []);
	(0, import_react.useEffect)(() => {
		listInputs().then(setDevices);
	}, []);
	const hours = estimateHours(state.fftSize, !state.levelsOnly, state.screenOnEstimate);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col gap-6 p-4 lg:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-medium",
				children: "Setup"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mist",
				children: "Sample rate follows the audio context. The filter design target is 48 kHz."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm",
						children: [
							"Calibration offset · ",
							cal.toFixed(1),
							" dB"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: -20,
						max: 20,
						step: .1,
						value: cal,
						onChange: (e) => {
							const value = Number(e.target.value);
							state.setCal(state.deviceKey, value);
							getEngine().setCalibrationOffsetDb(value);
						},
						className: "w-full"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-mist",
						children: [
							"Stored for this input (",
							state.deviceKey === "demo" ? "demo" : "microphone",
							")."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: "Side-by-side with a handheld meter"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-mist",
						children: [
							"Current LAF is ",
							fmtDb(liveLaf),
							". Type what the reference reads. The offset becomes the difference. This does not certify the result."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							inputMode: "decimal",
							value: refDb,
							onChange: (e) => setRefDb(e.target.value),
							placeholder: "Reference dB",
							className: "h-12 flex-1 rounded-xl border border-line bg-bg px-3 text-base"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-12 rounded-xl bg-phosphor px-4 text-sm font-medium text-bg",
							onClick: () => {
								const ref = Number(refDb);
								if (!Number.isFinite(ref) || liveLaf === null || !Number.isFinite(liveLaf)) return;
								const next = Math.max(-20, Math.min(20, cal + (ref - liveLaf)));
								state.setCal(state.deviceKey, next);
								getEngine().setCalibrationOffsetDb(next);
							},
							children: "Apply"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm",
						children: "Input"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							["bass", "Bass demo"],
							["room", "Room demo"],
							["tone1k", "1 kHz"]
						].map(([kind, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `h-11 rounded-full px-4 text-sm ${state.demoKind === kind && state.deviceKey === "demo" ? "bg-phosphor text-bg" : "border border-line"}`,
							onClick: () => {
								state.patch({
									demoKind: kind,
									deviceKey: "demo"
								});
								const next = state.calByDevice.demo ?? 0;
								getEngine().setCalibrationOffsetDb(next);
								startDemo(kind);
							},
							children: label
						}, kind))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 self-start rounded-full border border-line px-4 text-sm",
						onClick: () => void listInputs().then(setDevices),
						children: "Refresh devices"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "flex flex-col gap-2",
						children: [devices.map((device) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-12 w-full rounded-xl border border-line px-3 text-left text-sm",
							onClick: () => {
								setMicError(null);
								const key = device.id ? `mic:${device.id}` : "mic:default";
								state.patch({ deviceKey: key });
								const next = state.calByDevice[key] ?? 0;
								getEngine().setCalibrationOffsetDb(next);
								startMic(device.id || null).catch((err) => {
									setMicError(err instanceof Error ? err.message : "Microphone blocked.");
									startDemo(state.demoKind);
								});
							},
							children: device.label
						}) }, device.id || device.label)), devices.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-sm text-mist",
							children: "No device names yet. Grant the mic, then refresh."
						}) : null]
					}),
					micError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-alarm",
						children: micError
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
				on: state.levelsOnly,
				label: "Levels only",
				detail: "On: meters and spectrum, no audio. Off: keep up to 60 seconds of 16-bit mono in this tab. Evidence audio is not trimmed or equalized.",
				onChange: (on) => state.patch({ levelsOnly: on })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
				on: state.stampLocation,
				label: "Stamp location",
				detail: "Off by default. When on, an incident start asks for this device’s location and writes lat/lon if you allow it.",
				onChange: (on) => state.patch({ stampLocation: on })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
				on: state.screenOnEstimate,
				label: "Screen-on battery estimate",
				detail: "Planning figure for a 4700 mAh phone. Not a measurement of this browser.",
				onChange: (on) => state.patch({ screenOnEstimate: on })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "text-sm",
					children: "FFT size"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-2",
					children: [
						4096,
						8192,
						16384
					].map((size) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `h-11 flex-1 rounded-full text-sm ${state.fftSize === size ? "bg-phosphor text-bg" : "border border-line"}`,
						onClick: () => {
							state.patch({ fftSize: size });
							getEngine().setFftSize(size);
						},
						children: size
					}, size))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
						className: "text-sm",
						children: "Spectrogram window"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2",
						children: [
							30,
							60,
							120
						].map((sec) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `h-11 flex-1 rounded-full text-sm ${state.spectroSeconds === sec ? "bg-phosphor text-bg" : "border border-line"}`,
							onClick: () => state.patch({ spectroSeconds: sec }),
							children: [sec, "s"]
						}, sec))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2",
						children: ["c", "z"].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `h-11 flex-1 rounded-full text-sm ${state.specColor === c ? "bg-phosphor text-bg" : "border border-line"}`,
							onClick: () => {
								state.patch({ specColor: c });
								getEngine().setSpectrogramColor(c);
							},
							children: c === "c" ? "Color dBC" : "Color dBZ"
						}, c))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "nums text-sm text-mist",
				children: [
					"About ",
					hours.toFixed(1),
					" h at these settings · 4700 mAh planning estimate"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-line bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium tracking-wide text-phosphor",
					children: "EVIDENCE DISCLAIMER · ALWAYS ON"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm leading-relaxed text-pretty",
					children: DISCLAIMER
				})]
			})
		]
	});
}
function Toggle({ on, label, detail, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		role: "switch",
		"aria-checked": on,
		onClick: () => onChange(!on),
		className: "flex items-start justify-between gap-4 rounded-2xl border border-line px-4 py-3 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-sm",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mt-1 block text-xs leading-relaxed text-mist",
			children: detail
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `mt-1 h-7 w-12 shrink-0 rounded-full p-1 ${on ? "bg-phosphor" : "bg-surface-2"}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `block h-5 w-5 rounded-full bg-bg ${on ? "ml-5" : ""}` })
		})]
	});
}
function GuidePanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "flex flex-col gap-5 p-4 text-sm leading-relaxed lg:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg font-medium",
				children: "How to log a noise incident"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-mist",
				children: "This page is the measurement bench: the same IEC-style A and C filters, Fast/Slow levels, and evidence pack. It uses this browser’s microphone or a built-in demo. It is not a certified meter and it does not keep running with the screen off."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-medium",
					children: "Calibrate"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Until you set an offset, treat numbers as comparative — quieter versus louder in the same spot, same gain. If you have a handheld meter, play or wait for a steady tone, type its reading under Setup, and apply. The offset is remembered per input. A 1 kHz tone makes A and C agree; use that when you want to see the offset without bass weighting getting in the way. ±20 dB is the slider range. Do not invent a class rating from it." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-medium",
						children: "Export a pack"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "End an incident, then export from the summary or the logbook. The zip holds a slate, an 8 Hz meter CSV, session.json, a one-page PDF with the disclaimer in the footer, and SHA-256 hashes. Timestamps are ISO-8601 with the local offset and are not rewritten. Levels-only is the default, so the pack has no audio to edit." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex flex-wrap gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								className: "text-phosphor underline",
								href: "/samples/demo-60s-meters.csv",
								children: "60 s demo CSV"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								className: "text-phosphor underline",
								href: "/samples/demo-60s-session.json",
								children: "session.json"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								className: "text-phosphor underline",
								href: "/samples/demo-60s-report.pdf",
								children: "PDF"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								className: "text-phosphor underline",
								href: "/samples/session.schema.json",
								children: "schema"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-medium",
					children: "What this is not"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No speech-to-text, no beamforming toward a neighbor, no wall-contact mode, no cloud upload, and no “AI” nuisance label. Perceived direction is a note you type. Do not aim this at a conversation." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-medium",
					children: "If you run a native phone build later"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "list-disc pl-5 text-mist",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Allow the microphone, and notifications, so a foreground recording cannot hide." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Turn off battery restriction so a screen-off log is not killed overnight." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Prefer an unprocessed input. Turn off automatic gain, noise suppression, and echo cancel." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "A phone with several built-in mics: pick the one that actually hears the bass, and keep that choice." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "USB-C microphones should be named in the session header. Unplug events belong in the event log." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Leave the clock on automatic time. A manual clock makes the timestamps follow the wrong time." })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-pretty text-mist",
				children: DISCLAIMER
			})
		]
	});
}
var NAV = [
	{
		id: "meter",
		label: "Meter",
		icon: Gauge
	},
	{
		id: "spectrum",
		label: "Spectrum",
		icon: AudioLines
	},
	{
		id: "spectrogram",
		label: "Gram",
		icon: Waves
	},
	{
		id: "logbook",
		label: "Log",
		icon: BookOpen
	},
	{
		id: "settings",
		label: "Setup",
		icon: Settings
	}
];
function DecibelApp() {
	const [screen, setScreen] = (0, import_react.useState)("meter");
	const [intro, setIntro] = (0, import_react.useState)(false);
	const [slate, setSlate] = (0, import_react.useState)(false);
	const [summary, setSummary] = (0, import_react.useState)(null);
	const [weight, setWeight] = (0, import_react.useState)("fast");
	(0, import_react.useEffect)(() => {
		const settings = useLogbook.getState();
		const cal = settings.calByDevice[settings.deviceKey] ?? 0;
		const eng = getEngine();
		eng.setCalibrationOffsetDb(cal);
		eng.setFftSize(settings.fftSize);
		eng.setSpectrogramColor(settings.specColor);
		startDemo(settings.demoKind);
		bootEngine({
			calOffsetDb: cal,
			fftSize: settings.fftSize,
			specColor: settings.specColor
		}).catch(() => void 0);
		try {
			if (!localStorage.getItem("decibellog-intro-ok")) setIntro(true);
		} catch {
			setIntro(true);
		}
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { onGuide: () => setScreen("guide") }),
			intro ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto max-w-6xl px-4 pt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-line bg-surface p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-base font-medium",
							children: "Before you trust a number"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-pretty text-mist",
							children: "This is not a certified meter. Until you set an offset in Setup, use the levels only to compare quiet and loud in this room. Timestamps follow this clock. There is no speech transcription."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-3 h-11 rounded-full bg-phosphor px-4 text-sm font-medium text-bg",
							onClick: () => {
								try {
									localStorage.setItem("decibellog-intro-ok", "1");
								} catch {}
								setIntro(false);
							},
							children: "Understood"
						})
					]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto grid w-full max-w-6xl pb-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: screen === "meter" ? "block" : "hidden lg:block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MeterPanel, {
						weight,
						onWeight: setWeight,
						summary,
						onIncident: (running) => {
							if (running) setSummary(endIncident());
							else setSlate(true);
						},
						onDismissSummary: () => setSummary(null)
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: screen === "meter" ? "hidden lg:block lg:border-l lg:border-line" : "lg:border-l lg:border-line",
					children: [
						screen === "meter" || screen === "spectrum" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpectrumPanel, {}) : null,
						screen === "spectrogram" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpectrogramPanel, {}) : null,
						screen === "logbook" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogbookPanel, {}) : null,
						screen === "settings" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsPanel, {}) : null,
						screen === "guide" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuidePanel, {}) : null
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "sticky bottom-0 z-30 border-t border-line bg-bg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-2 text-xs leading-snug text-pretty text-mist",
					children: "Not a certified meter. Uncalibrated unless you set an offset. Comparative only. Timestamps follow this clock. No speech transcription. Levels-only packs contain no audio."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "grid grid-cols-5 border-t border-line",
					children: NAV.map((item) => {
						const Icon = item.icon;
						const active = screen === item.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setScreen(item.id),
							className: `flex h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-phosphor" : "text-mist"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-5",
								"aria-hidden": "true"
							}), item.label]
						}, item.id);
					})
				})]
			}),
			slate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slate, {
				onClose: () => setSlate(false),
				onStart: async (meta) => {
					await beginIncident(meta);
					setSlate(false);
					setSummary(null);
				}
			}) : null
		]
	});
}
function Header({ onGuide }) {
	const [now, setNow] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const tick = () => setNow(/* @__PURE__ */ new Date());
		tick();
		const id = window.setInterval(tick, 1e3);
		const unsub = getEngine().subscribe((_frame, next) => setStatus(next));
		return () => {
			window.clearInterval(id);
			unsub();
		};
	}, []);
	const zone = now ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
	const clock = now ? now.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit"
	}) : "——";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-widest text-phosphor",
					children: "DECIBELLOG"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-mist",
					children: "Comparative A / C levels"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "nums text-lg leading-none",
						children: clock
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-mist",
						children: zone
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onGuide,
					className: "flex size-11 items-center justify-center rounded-full border border-line",
					"aria-label": "Guide",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-5" })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mx-auto flex max-w-6xl flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-xs text-mist",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status?.sourceLabel ?? "Starting demo" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "nums",
					children: status ? `${(status.sampleRate / 1e3).toFixed(1)} kHz` : ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "nums",
					children: ["offset ", status ? `${status.calOffsetDb >= 0 ? "+" : ""}${status.calOffsetDb.toFixed(1)} dB` : ""]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status?.sessionId ? "Session on" : "Session off" })
			]
		})]
	});
}
function MeterPanel({ weight, onWeight, summary, onIncident, onDismissSummary }) {
	const [frame, setFrame] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)(null);
	const [, setTick] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const unsub = getEngine().subscribe((next, st) => {
			setFrame(next);
			setStatus(st);
		});
		const id = window.setInterval(() => setTick((n) => n + 1), 500);
		return () => {
			unsub();
			window.clearInterval(id);
		};
	}, []);
	const a = weight === "fast" ? frame?.laf : frame?.las;
	const c = weight === "fast" ? frame?.lcf : frame?.lcs;
	const aLabel = weight === "fast" ? "LAF" : "LAS";
	const cLabel = weight === "fast" ? "LCF" : "LCS";
	const offset = frame?.calOffsetDb ?? 0;
	const elapsed = status?.incidentStartedEpochMs != null ? (Date.now() - status.incidentStartedEpochMs) / 1e3 : 0;
	const running = Boolean(status?.incidentId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4 p-4 lg:p-6",
		children: [
			frame?.clipped ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-xl bg-alarm px-3 py-2 text-center text-sm font-medium text-bg",
				children: "Digital clip"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Readout, {
					label: aLabel,
					value: a,
					offset,
					clipped: frame?.clipped
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Readout, {
					label: cLabel,
					value: c,
					offset,
					clipped: frame?.clipped,
					pale: true
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LAS",
						value: frame?.las
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LCS",
						value: frame?.lcs
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LZF",
						value: frame?.lzf
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LAeq",
						value: frame?.laeq
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LCeq",
						value: frame?.lceq
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LC−LA",
						value: frame?.lcMinusLa,
						emphasize: true
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": weight === "fast",
					onClick: () => onWeight("fast"),
					className: `h-11 flex-1 rounded-full text-sm ${weight === "fast" ? "bg-phosphor text-bg" : "border border-line"}`,
					children: "Fast 125 ms"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": weight === "slow",
					onClick: () => onWeight("slow"),
					className: `h-11 flex-1 rounded-full text-sm ${weight === "slow" ? "bg-phosphor text-bg" : "border border-line"}`,
					children: "Slow 1 s"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "col-span-2 h-12 rounded-xl border border-line text-sm",
						onClick: () => {
							const eng = getEngine();
							if (eng.status().sessionId) eng.stopSession();
							else eng.startSession();
						},
						children: status?.sessionId ? "Stop session" : "Start session"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-12 rounded-xl border border-line text-sm",
						onClick: () => getEngine().resetPeakHold(),
						children: "Reset peak"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-12 rounded-xl border border-line text-sm",
						onClick: () => burstFullScale(),
						children: "Clip test"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => onIncident(running),
				className: `h-16 rounded-2xl text-lg font-medium tracking-wide ${running ? "incident-live border border-alarm bg-bg text-alarm" : "bg-alarm text-bg"}`,
				children: running ? `End incident ${fmtDur(elapsed)}` : "Incident"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: !running && !summary,
				onClick: () => getEngine().captureBaseline(45),
				className: "h-12 rounded-xl border border-line text-sm disabled:opacity-40",
				children: status && status.baselineRemainingSec > 0 ? `Baseline ${Math.ceil(status.baselineRemainingSec)}s left` : "Capture quiet baseline · 45s"
			}),
			summary?.summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-phosphor/40 bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Incident closed"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "nums mt-2 text-sm",
						children: [
							fmtDur(summary.summary.durationSec),
							" · LAeq ",
							fmtDb(summary.summary.laeq),
							" · LCeq ",
							fmtDb(summary.summary.lceq),
							" · LC−LA",
							" ",
							fmtDb(summary.summary.lcMinusLa)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-mist",
						children: [
							"LAmax,F ",
							fmtDb(summary.summary.lafMax),
							" · LCpeak ",
							fmtDb(summary.summary.lcPeak),
							" · clip rows ",
							summary.summary.clippedRows
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-11 rounded-full bg-phosphor px-4 text-sm font-medium text-bg",
							onClick: () => void downloadIncident(summary),
							children: "Export pack"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-11 rounded-full border border-line px-4 text-sm",
							onClick: onDismissSummary,
							children: "Dismiss"
						})]
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs leading-relaxed text-pretty text-mist",
				children: offset === 0 ? "Showing dB relative to digital full scale. Same room, same gain: compare, don’t certify." : `Includes your ${offset.toFixed(1)} dB offset. Still not a certified sound pressure level.`
			})
		]
	});
}
function Readout({ label, value, offset, clipped, pale }) {
	const pct = levelPct(value ?? -160, offset);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `rounded-2xl border bg-surface p-3 ${clipped ? "border-alarm" : "border-line"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-mist",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: `nums mt-1 text-5xl leading-none sm:text-6xl ${pale ? "text-fg" : "text-phosphor"}`,
				children: fmtDb(value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 h-2 overflow-hidden rounded-full bg-surface-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `h-full ${clipped ? "bg-alarm" : pale ? "bg-fg" : "bg-phosphor"}`,
					style: { width: `${pct * 100}%` }
				})
			})
		]
	});
}
function Stat({ label, value, emphasize }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line bg-surface px-2 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-mist",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: `nums text-lg ${emphasize ? "text-phosphor" : ""}`,
			children: fmtDb(value)
		})]
	});
}
function Slate({ onClose, onStart }) {
	const [meta, setMeta] = (0, import_react.useState)({
		...EMPTY_META,
		room: "bedroom"
	});
	const [busy, setBusy] = (0, import_react.useState)(false);
	const set = (key, value) => setMeta((m) => ({
		...m,
		[key]: value
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 sm:items-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "max-h-[90dvh] w-full max-w-md overflow-auto rounded-2xl border border-line bg-surface p-5",
			onSubmit: (e) => {
				e.preventDefault();
				setBusy(true);
				onStart(meta).finally(() => setBusy(false));
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-medium",
					children: "Incident slate"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-mist",
					children: "Your notes. Nothing here identifies a neighbor’s voice."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Your name",
							value: meta.name,
							onChange: (v) => set("name", v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Address / unit",
							value: meta.address,
							onChange: (v) => set("address", v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Room",
							value: meta.room,
							onChange: (v) => set("room", v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
							label: "Windows",
							value: meta.windows,
							options: [
								"open",
								"closed",
								"unknown"
							],
							onChange: (v) => set("windows", v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
							label: "Perceived direction",
							value: meta.direction,
							options: [
								"above",
								"below",
								"adjacent",
								"street",
								"inside",
								"unknown"
							],
							onChange: (v) => set("direction", v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
							label: "Noise type",
							value: meta.noiseType,
							options: [
								"music",
								"bass",
								"barking",
								"impact",
								"traffic",
								"mechanical",
								"other"
							],
							onChange: (v) => set("noiseType", v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex flex-col gap-1 text-sm",
							children: ["Note", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: meta.note,
								onChange: (e) => set("note", e.target.value),
								rows: 3,
								className: "rounded-xl border border-line bg-bg px-3 py-2 text-base"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-12 flex-1 rounded-xl border border-line",
						onClick: onClose,
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: busy,
						className: "h-12 flex-1 rounded-xl bg-alarm font-medium text-bg disabled:opacity-50",
						children: busy ? "Starting…" : "Start incident"
					})]
				})
			]
		})
	});
}
function Field({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex flex-col gap-1 text-sm",
		children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			value,
			onChange: (e) => onChange(e.target.value),
			className: "h-12 rounded-xl border border-line bg-bg px-3 text-base"
		})]
	});
}
function Select({ label, value, options, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex flex-col gap-1 text-sm",
		children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
			value,
			onChange: (e) => onChange(e.target.value),
			className: "h-12 rounded-xl border border-line bg-bg px-3 text-base",
			children: options.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: opt,
				children: opt
			}, opt))
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DecibelApp, {});
}
//#endregion
export { Home as component };

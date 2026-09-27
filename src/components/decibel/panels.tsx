import { useEffect, useMemo, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/evidence/disclaimer";
import { getEngine, listInputs, startDemo, startMic, estimateHours } from "@/lib/engine/runtime";
import type { SpectrumFrame } from "@/lib/engine/types";
import { useLogbook } from "@/lib/store";
import { copySummary, downloadIncident } from "./actions";
import { fmtDb, fmtDur } from "./format";

function xOf(freq: number): number {
  const min = Math.log10(20);
  const max = Math.log10(20_000);
  return ((Math.log10(Math.min(20_000, Math.max(20, freq))) - min) / (max - min)) * 640;
}

function yOf(db: number, lo: number, hi: number): number {
  const t = (db - lo) / (hi - lo || 1);
  return 250 - Math.max(0, Math.min(1, t)) * 230;
}

function poly(bands: { fc: number; db: number }[], lo: number, hi: number): string {
  return bands
    .filter((b) => b.fc >= 20 && b.fc <= 20_000)
    .map((b, i) => `${i === 0 ? "M" : "L"}${xOf(b.fc).toFixed(1)} ${yOf(b.db, lo, hi).toFixed(1)}`)
    .join(" ");
}

const GRID_HZ = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

export function SpectrumPanel() {
  const [frame, setFrame] = useState<SpectrumFrame | null>(null);
  const [hold, setHold] = useState(true);
  const peakA = useRef<number[]>([]);
  const peakC = useRef<number[]>([]);
  const offset = useLogbook((s) => s.calByDevice[s.deviceKey] ?? 0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = getEngine().getSpectrum();
      if (!next) return;
      setFrame(next);
      const grow = (dst: number[], src: { db: number }[]) => {
        for (let i = 0; i < src.length; i++) dst[i] = Math.max(dst[i] ?? -200, src[i]!.db);
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
  const peakPathA = peakA.current.length
    ? poly(
        a.map((b, i) => ({ fc: b.fc, db: peakA.current[i] ?? b.db })),
        lo,
        hi,
      )
    : "";

  return (
    <section className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Spectrum</h2>
          <p className="text-sm text-mist">
            1/3-octave, log frequency. A is phosphor, C is the pale trace. Low bands are limited by FFT bin width
            {frame ? ` (${frame.fftSize}, ${(frame.binHz).toFixed(2)} Hz).` : "."}
          </p>
        </div>
        <button
          type="button"
          className="h-11 shrink-0 rounded-full border border-line px-4 text-sm"
          onClick={() => {
            peakA.current = [];
            peakC.current = [];
            setHold(true);
          }}
        >
          Reset peak
        </button>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <svg viewBox="0 0 640 270" className="h-64 w-full text-mist" role="img" aria-label="A and C weighted third-octave spectrum">
          {GRID_HZ.map((hz) => (
            <g key={hz}>
              <line x1={xOf(hz)} x2={xOf(hz)} y1="16" y2="250" stroke="currentColor" strokeOpacity="0.25" />
              <text x={xOf(hz)} y="266" textAnchor="middle" fill="currentColor" fontSize="11">
                {hz >= 1000 ? `${hz / 1000}k` : hz}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((t) => {
            const db = lo + (hi - lo) * t;
            const y = yOf(db, lo, hi);
            return (
              <g key={t}>
                <line x1="0" x2="640" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.25" />
                <text x="4" y={y - 4} fill="currentColor" fontSize="11">
                  {db.toFixed(0)}
                </text>
              </g>
            );
          })}
          {peakPathA ? (
            <path d={peakPathA} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeDasharray="3 4" strokeWidth="1.25" />
          ) : null}
          <path d={poly(c, lo, hi)} fill="none" stroke="currentColor" strokeWidth="1.75" className="text-fg" />
          <path d={poly(a, lo, hi)} fill="none" stroke="currentColor" strokeWidth="2.25" className="text-phosphor" />
        </svg>
        <div className="mt-2 flex gap-4 text-xs text-mist">
          <span className="text-phosphor">A-weighted</span>
          <span className="text-fg">C-weighted</span>
          <span>Dashed · peak hold</span>
        </div>
      </div>
      <p className="text-sm text-mist">
        A bass-heavy demo should sit higher on the C trace below a few hundred hertz. That gap is LC−LA, not a source
        direction.
      </p>
    </section>
  );
}

export function SpectrogramPanel() {
  const seconds = useLogbook((s) => s.spectroSeconds);
  const color = useLogbook((s) => s.specColor);
  const [cols, setCols] = useState<number[][]>([]);
  const [centers, setCenters] = useState<number[]>([]);

  useEffect(() => {
    getEngine().setSpectrogramColor(color);
  }, [color]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const gram = getEngine().getSpectrogram();
      setCenters(gram.centers);
      setCols(gram.columns.slice(-seconds * 4));
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);

  const picture = useMemo(() => drawGram(cols), [cols]);
  const labels = centers.filter((_, i) => i % 3 === 0).slice().reverse();

  return (
    <section className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h2 className="text-lg font-medium">Spectrogram</h2>
        <p className="text-sm text-mist">
          Last {seconds}s, 25 Hz–2 kHz, color is {color === "c" ? "dBC" : "dBZ"}. Brighter is louder. Meant for bass,
          not for reading speech.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3">
        {cols.length === 0 ? (
          <p className="flex h-56 items-center justify-center text-sm text-mist">Waiting for the first FFT window.</p>
        ) : (
          <div className="flex gap-2">
            <div className="flex h-56 w-10 flex-col justify-between py-1 text-right text-xs text-mist">
              {labels.slice(0, 6).map((fc) => (
                <span key={fc}>{fc >= 1000 ? `${fc / 1000}k` : Math.round(fc)}</span>
              ))}
            </div>
            <svg viewBox="0 0 640 240" className="h-56 w-full text-phosphor" role="img" aria-label="Low-frequency spectrogram">
              <g dangerouslySetInnerHTML={{ __html: picture }} />
            </svg>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-mist">
          <span>quiet</span>
          <span className="h-2 flex-1 rounded-full bg-surface-2">
            <span className="block h-2 w-full rounded-full bg-phosphor opacity-80" />
          </span>
          <span>loud</span>
        </div>
      </div>
    </section>
  );
}

function drawGram(cols: number[][]): string {
  if (cols.length === 0) return "";
  let maxDb = -160;
  for (const col of cols) for (const v of col) if (v > maxDb) maxDb = v;
  const floor = maxDb - 48;
  const cw = 640 / cols.length;
  const parts: string[] = [];
  for (let x = 0; x < cols.length; x++) {
    const col = cols[x]!;
    const bh = 240 / Math.max(col.length, 1);
    for (let y = 0; y < col.length; y++) {
      const t = Math.max(0, Math.min(1, ((col[y] ?? floor) - floor) / 48));
      if (t < 0.05) continue;
      const yy = 240 - (y + 1) * bh;
      parts.push(
        `<rect x="${(x * cw).toFixed(2)}" y="${yy.toFixed(2)}" width="${(cw + 0.35).toFixed(2)}" height="${(bh + 0.35).toFixed(2)}" fill="currentColor" opacity="${t.toFixed(2)}"/>`,
      );
    }
  }
  return parts.join("");
}

export function LogbookPanel() {
  const incidents = useLogbook((s) => s.incidents);
  const remove = useLogbook((s) => s.removeIncident);
  const [day, setDay] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const shown = incidents.filter((inc) => {
    if (!day) return true;
    const local = new Date(inc.startedAt.epochMs);
    const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    return key === day;
  });

  return (
    <section className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Logbook</h2>
          <p className="text-sm text-mist">Newest three incidents keep meter rows. Older ones keep the summary only.</p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-mist">
          Date
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface px-3 text-base text-fg"
          />
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-mist">
          No incidents yet. Start a session, then mark an incident while the noise is happening.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((inc) => {
            const s = inc.summary;
            return (
              <li key={inc.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">
                    {inc.meta.room || "Room"} · {inc.meta.noiseType}
                  </h3>
                  <span className="nums text-sm text-mist">{inc.startedAt.iso}</span>
                </div>
                <p className="mt-1 text-sm text-mist">
                  {inc.meta.address || "No address"} · windows {inc.meta.windows} · {inc.meta.direction}
                </p>
                {s ? (
                  <p className="nums mt-3 text-sm">
                    {fmtDur(s.durationSec)} · LAeq {fmtDb(s.laeq)} · LCeq {fmtDb(s.lceq)} · LC−LA {fmtDb(s.lcMinusLa)}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-mist">No summary.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-11 rounded-full bg-phosphor px-4 text-sm font-medium text-bg disabled:opacity-50"
                    disabled={busy === inc.id}
                    onClick={() => {
                      setBusy(inc.id);
                      void downloadIncident(inc).finally(() => setBusy(null));
                    }}
                  >
                    {busy === inc.id ? "Packing…" : "Export pack"}
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-full border border-line px-4 text-sm"
                    onClick={() => void copySummary(inc).catch(() => undefined)}
                  >
                    Copy summary
                  </button>
                  {pendingDelete === inc.id ? (
                    <button
                      type="button"
                      className="h-11 rounded-full bg-alarm px-4 text-sm font-medium text-bg"
                      onClick={() => {
                        remove(inc.id);
                        setPendingDelete(null);
                      }}
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button type="button" className="h-11 rounded-full border border-line px-4 text-sm" onClick={() => setPendingDelete(inc.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function SettingsPanel() {
  const state = useLogbook();
  const cal = state.calByDevice[state.deviceKey] ?? 0;
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [refDb, setRefDb] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [liveLaf, setLiveLaf] = useState<number | null>(null);

  useEffect(() => {
    return getEngine().subscribe((frame) => setLiveLaf(frame.laf));
  }, []);

  useEffect(() => {
    void listInputs().then(setDevices);
  }, []);

  const hours = estimateHours(state.fftSize, !state.levelsOnly, state.screenOnEstimate);

  return (
    <section className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h2 className="text-lg font-medium">Setup</h2>
        <p className="text-sm text-mist">Sample rate follows the audio context. The filter design target is 48 kHz.</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Calibration offset · {cal.toFixed(1)} dB</span>
        <input
          type="range"
          min={-20}
          max={20}
          step={0.1}
          value={cal}
          onChange={(e) => {
            const value = Number(e.target.value);
            state.setCal(state.deviceKey, value);
            getEngine().setCalibrationOffsetDb(value);
          }}
          className="w-full"
        />
        <span className="text-xs text-mist">Stored for this input ({state.deviceKey === "demo" ? "demo" : "microphone"}).</span>
      </label>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm">Side-by-side with a handheld meter</p>
        <p className="text-xs text-mist">
          Current LAF is {fmtDb(liveLaf)}. Type what the reference reads. The offset becomes the difference. This does not
          certify the result.
        </p>
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            value={refDb}
            onChange={(e) => setRefDb(e.target.value)}
            placeholder="Reference dB"
            className="h-12 flex-1 rounded-xl border border-line bg-bg px-3 text-base"
          />
          <button
            type="button"
            className="h-12 rounded-xl bg-phosphor px-4 text-sm font-medium text-bg"
            onClick={() => {
              const ref = Number(refDb);
              if (!Number.isFinite(ref) || liveLaf === null || !Number.isFinite(liveLaf)) return;
              const next = Math.max(-20, Math.min(20, cal + (ref - liveLaf)));
              state.setCal(state.deviceKey, next);
              getEngine().setCalibrationOffsetDb(next);
            }}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm">Input</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["bass", "Bass demo"],
              ["room", "Room demo"],
              ["tone1k", "1 kHz"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={`h-11 rounded-full px-4 text-sm ${state.demoKind === kind && state.deviceKey === "demo" ? "bg-phosphor text-bg" : "border border-line"}`}
              onClick={() => {
                state.patch({ demoKind: kind, deviceKey: "demo" });
                const next = state.calByDevice.demo ?? 0;
                getEngine().setCalibrationOffsetDb(next);
                startDemo(kind);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="h-11 self-start rounded-full border border-line px-4 text-sm"
          onClick={() => void listInputs().then(setDevices)}
        >
          Refresh devices
        </button>
        <ul className="flex flex-col gap-2">
          {devices.map((device) => (
            <li key={device.id || device.label}>
              <button
                type="button"
                className="h-12 w-full rounded-xl border border-line px-3 text-left text-sm"
                onClick={() => {
                  setMicError(null);
                  const key = device.id ? `mic:${device.id}` : "mic:default";
                  state.patch({ deviceKey: key });
                  const next = state.calByDevice[key] ?? 0;
                  getEngine().setCalibrationOffsetDb(next);
                  void startMic(device.id || null).catch((err: unknown) => {
                    setMicError(err instanceof Error ? err.message : "Microphone blocked.");
                    startDemo(state.demoKind);
                  });
                }}
              >
                {device.label}
              </button>
            </li>
          ))}
          {devices.length === 0 ? <li className="text-sm text-mist">No device names yet. Grant the mic, then refresh.</li> : null}
        </ul>
        {micError ? <p className="text-sm text-alarm">{micError}</p> : null}
      </div>

      <Toggle
        on={state.levelsOnly}
        label="Levels only"
        detail="On: meters and spectrum, no audio. Off: keep up to 60 seconds of 16-bit mono in this tab. Evidence audio is not trimmed or equalized."
        onChange={(on) => state.patch({ levelsOnly: on })}
      />
      <Toggle
        on={state.stampLocation}
        label="Stamp location"
        detail="Off by default. When on, an incident start asks for this device’s location and writes lat/lon if you allow it."
        onChange={(on) => state.patch({ stampLocation: on })}
      />
      <Toggle
        on={state.screenOnEstimate}
        label="Screen-on battery estimate"
        detail="Planning figure for a 4700 mAh phone. Not a measurement of this browser."
        onChange={(on) => state.patch({ screenOnEstimate: on })}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm">FFT size</legend>
        <div className="flex gap-2">
          {([4096, 8192, 16384] as const).map((size) => (
            <button
              key={size}
              type="button"
              className={`h-11 flex-1 rounded-full text-sm ${state.fftSize === size ? "bg-phosphor text-bg" : "border border-line"}`}
              onClick={() => {
                state.patch({ fftSize: size });
                getEngine().setFftSize(size);
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm">Spectrogram window</legend>
        <div className="flex gap-2">
          {([30, 60, 120] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              className={`h-11 flex-1 rounded-full text-sm ${state.spectroSeconds === sec ? "bg-phosphor text-bg" : "border border-line"}`}
              onClick={() => state.patch({ spectroSeconds: sec })}
            >
              {sec}s
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["c", "z"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`h-11 flex-1 rounded-full text-sm ${state.specColor === c ? "bg-phosphor text-bg" : "border border-line"}`}
              onClick={() => {
                state.patch({ specColor: c });
                getEngine().setSpectrogramColor(c);
              }}
            >
              {c === "c" ? "Color dBC" : "Color dBZ"}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="nums text-sm text-mist">About {hours.toFixed(1)} h at these settings · 4700 mAh planning estimate</p>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-medium tracking-wide text-phosphor">EVIDENCE DISCLAIMER · ALWAYS ON</p>
        <p className="mt-2 text-sm leading-relaxed text-pretty">{DISCLAIMER}</p>
      </div>
    </section>
  );
}

function Toggle({
  on,
  label,
  detail,
  onChange,
}: {
  on: boolean;
  label: string;
  detail: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-start justify-between gap-4 rounded-2xl border border-line px-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-mist">{detail}</span>
      </span>
      <span className={`mt-1 h-7 w-12 shrink-0 rounded-full p-1 ${on ? "bg-phosphor" : "bg-surface-2"}`}>
        <span className={`block h-5 w-5 rounded-full bg-bg ${on ? "ml-5" : ""}`} />
      </span>
    </button>
  );
}

export function GuidePanel() {
  return (
    <article className="flex flex-col gap-5 p-4 text-sm leading-relaxed lg:p-6">
      <header>
        <h2 className="text-lg font-medium">How to log a noise incident</h2>
        <p className="mt-1 text-mist">
          This page is the measurement bench: the same IEC-style A and C filters, Fast/Slow levels, and evidence pack.
          It uses this browser’s microphone or a built-in demo. It is not a certified meter and it does not keep
          running with the screen off.
        </p>
      </header>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Calibrate</h3>
        <p>
          Until you set an offset, treat numbers as comparative — quieter versus louder in the same spot, same gain.
          If you have a handheld meter, play or wait for a steady tone, type its reading under Setup, and apply. The
          offset is remembered per input. A 1 kHz tone makes A and C agree; use that when you want to see the offset
          without bass weighting getting in the way. ±20 dB is the slider range. Do not invent a class rating from it.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Export a pack</h3>
        <p>
          End an incident, then export from the summary or the logbook. The zip holds a slate, an 8 Hz meter CSV,
          session.json, a one-page PDF with the disclaimer in the footer, and SHA-256 hashes. Timestamps are ISO-8601
          with the local offset and are not rewritten. Levels-only is the default, so the pack has no audio to edit.
        </p>
        <p className="flex flex-wrap gap-3">
          <a className="text-phosphor underline" href="/samples/demo-60s-meters.csv">
            60 s demo CSV
          </a>
          <a className="text-phosphor underline" href="/samples/demo-60s-session.json">
            session.json
          </a>
          <a className="text-phosphor underline" href="/samples/demo-60s-report.pdf">
            PDF
          </a>
          <a className="text-phosphor underline" href="/samples/session.schema.json">
            schema
          </a>
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">What this is not</h3>
        <p>
          No speech-to-text, no beamforming toward a neighbor, no wall-contact mode, no cloud upload, and no “AI”
          nuisance label. Perceived direction is a note you type. Do not aim this at a conversation.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">If you run a native phone build later</h3>
        <ul className="list-disc pl-5 text-mist">
          <li>Allow the microphone, and notifications, so a foreground recording cannot hide.</li>
          <li>Turn off battery restriction so a screen-off log is not killed overnight.</li>
          <li>Prefer an unprocessed input. Turn off automatic gain, noise suppression, and echo cancel.</li>
          <li>A phone with several built-in mics: pick the one that actually hears the bass, and keep that choice.</li>
          <li>USB-C microphones should be named in the session header. Unplug events belong in the event log.</li>
          <li>Leave the clock on automatic time. A manual clock makes the timestamps follow the wrong time.</li>
        </ul>
      </section>
      <p className="text-pretty text-mist">{DISCLAIMER}</p>
    </article>
  );
}

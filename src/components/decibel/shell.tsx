import { useEffect, useState } from "react";
import {
  AudioLines,
  BookOpen,
  CircleHelp,
  Gauge,
  Settings,
  Waves,
} from "lucide-react";
import type { EngineStatus, IncidentMeta, IncidentRecord, MeterFrame } from "@/lib/engine/types";
import { EMPTY_META } from "@/lib/engine/types";
import { bootEngine, burstFullScale, getEngine, startDemo } from "@/lib/engine/runtime";
import type { Screen } from "@/lib/store";
import { useLogbook } from "@/lib/store";
import { beginIncident, downloadIncident, endIncident } from "./actions";
import { fmtDb, fmtDur, levelPct } from "./format";
import { GuidePanel, LogbookPanel, SettingsPanel, SpectrogramPanel, SpectrumPanel } from "./panels";

const NAV: { id: Screen; label: string; icon: typeof Gauge }[] = [
  { id: "meter", label: "Meter", icon: Gauge },
  { id: "spectrum", label: "Spectrum", icon: AudioLines },
  { id: "spectrogram", label: "Gram", icon: Waves },
  { id: "logbook", label: "Log", icon: BookOpen },
  { id: "settings", label: "Setup", icon: Settings },
];

export function DecibelApp() {
  const [screen, setScreen] = useState<Screen>("meter");
  const [intro, setIntro] = useState(false);
  const [slate, setSlate] = useState(false);
  const [summary, setSummary] = useState<IncidentRecord | null>(null);
  const [weight, setWeight] = useState<"fast" | "slow">("fast");

  useEffect(() => {
    const settings = useLogbook.getState();
    const cal = settings.calByDevice[settings.deviceKey] ?? 0;
    const eng = getEngine();
    eng.setCalibrationOffsetDb(cal);
    eng.setFftSize(settings.fftSize);
    eng.setSpectrogramColor(settings.specColor);
    startDemo(settings.demoKind);
    void bootEngine({
      calOffsetDb: cal,
      fftSize: settings.fftSize,
      specColor: settings.specColor,
    }).catch(() => undefined);
    try {
      if (!localStorage.getItem("decibellog-intro-ok")) setIntro(true);
    } catch {
      setIntro(true);
    }
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Header onGuide={() => setScreen("guide")} />
      {intro ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-base font-medium">Before you trust a number</h2>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-mist">
              This is not a certified meter. Until you set an offset in Setup, use the levels only to compare quiet and
              loud in this room. Timestamps follow this clock. There is no speech transcription.
            </p>
            <button
              type="button"
              className="mt-3 h-11 rounded-full bg-phosphor px-4 text-sm font-medium text-bg"
              onClick={() => {
                try {
                  localStorage.setItem("decibellog-intro-ok", "1");
                } catch {
                  /* ignore */
                }
                setIntro(false);
              }}
            >
              Understood
            </button>
          </div>
        </div>
      ) : null}
      <main className="mx-auto grid w-full max-w-6xl pb-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <section className={screen === "meter" ? "block" : "hidden lg:block"}>
          <MeterPanel
            weight={weight}
            onWeight={setWeight}
            summary={summary}
            onIncident={(running) => {
              if (running) setSummary(endIncident());
              else setSlate(true);
            }}
            onDismissSummary={() => setSummary(null)}
          />
        </section>
        <section className={screen === "meter" ? "hidden lg:block lg:border-l lg:border-line" : "lg:border-l lg:border-line"}>
          {screen === "meter" || screen === "spectrum" ? <SpectrumPanel /> : null}
          {screen === "spectrogram" ? <SpectrogramPanel /> : null}
          {screen === "logbook" ? <LogbookPanel /> : null}
          {screen === "settings" ? <SettingsPanel /> : null}
          {screen === "guide" ? <GuidePanel /> : null}
        </section>
      </main>
      <footer className="sticky bottom-0 z-30 border-t border-line bg-bg">
        <p className="px-4 py-2 text-xs leading-snug text-pretty text-mist">
          Not a certified meter. Uncalibrated unless you set an offset. Comparative only. Timestamps follow this clock.
          No speech transcription. Levels-only packs contain no audio.
        </p>
        <nav className="grid grid-cols-5 border-t border-line">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id)}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-phosphor" : "text-mist"}`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </footer>
      {slate ? (
        <Slate
          onClose={() => setSlate(false)}
          onStart={async (meta) => {
            await beginIncident(meta);
            setSlate(false);
            setSummary(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Header({ onGuide }: { onGuide: () => void }) {
  const [now, setNow] = useState<Date | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    const unsub = getEngine().subscribe((_frame, next) => setStatus(next));
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, []);
  const zone = now ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const clock = now
    ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
    : "——";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs tracking-widest text-phosphor">DECIBELLOG</p>
          <p className="text-xs text-mist">Comparative A / C levels</p>
        </div>
        <div className="text-right">
          <p className="nums text-lg leading-none">{clock}</p>
          <p className="text-xs text-mist">{zone}</p>
        </div>
        <button type="button" onClick={onGuide} className="flex size-11 items-center justify-center rounded-full border border-line" aria-label="Guide">
          <CircleHelp className="size-5" />
        </button>
      </div>
      <p className="mx-auto flex max-w-6xl flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-xs text-mist">
        <span>{status?.sourceLabel ?? "Starting demo"}</span>
        <span className="nums">{status ? `${(status.sampleRate / 1000).toFixed(1)} kHz` : ""}</span>
        <span className="nums">offset {status ? `${status.calOffsetDb >= 0 ? "+" : ""}${status.calOffsetDb.toFixed(1)} dB` : ""}</span>
        <span>{status?.sessionId ? "Session on" : "Session off"}</span>
      </p>
    </header>
  );
}

function MeterPanel({
  weight,
  onWeight,
  summary,
  onIncident,
  onDismissSummary,
}: {
  weight: "fast" | "slow";
  onWeight: (w: "fast" | "slow") => void;
  summary: IncidentRecord | null;
  onIncident: (running: boolean) => void;
  onDismissSummary: () => void;
}) {
  const [frame, setFrame] = useState<MeterFrame | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
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
  const elapsed =
    status?.incidentStartedEpochMs != null ? (Date.now() - status.incidentStartedEpochMs) / 1000 : 0;
  const running = Boolean(status?.incidentId);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {frame?.clipped ? (
        <p className="rounded-xl bg-alarm px-3 py-2 text-center text-sm font-medium text-bg">Digital clip</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Readout label={aLabel} value={a} offset={offset} clipped={frame?.clipped} />
        <Readout label={cLabel} value={c} offset={offset} clipped={frame?.clipped} pale />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="LAS" value={frame?.las} />
        <Stat label="LCS" value={frame?.lcs} />
        <Stat label="LZF" value={frame?.lzf} />
        <Stat label="LAeq" value={frame?.laeq} />
        <Stat label="LCeq" value={frame?.lceq} />
        <Stat label="LC−LA" value={frame?.lcMinusLa} emphasize />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={weight === "fast"}
          onClick={() => onWeight("fast")}
          className={`h-11 flex-1 rounded-full text-sm ${weight === "fast" ? "bg-phosphor text-bg" : "border border-line"}`}
        >
          Fast 125 ms
        </button>
        <button
          type="button"
          aria-pressed={weight === "slow"}
          onClick={() => onWeight("slow")}
          className={`h-11 flex-1 rounded-full text-sm ${weight === "slow" ? "bg-phosphor text-bg" : "border border-line"}`}
        >
          Slow 1 s
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="col-span-2 h-12 rounded-xl border border-line text-sm"
          onClick={() => {
            const eng = getEngine();
            if (eng.status().sessionId) eng.stopSession();
            else eng.startSession();
          }}
        >
          {status?.sessionId ? "Stop session" : "Start session"}
        </button>
        <button
          type="button"
          className="h-12 rounded-xl border border-line text-sm"
          onClick={() => getEngine().resetPeakHold()}
        >
          Reset peak
        </button>
        <button type="button" className="h-12 rounded-xl border border-line text-sm" onClick={() => burstFullScale()}>
          Clip test
        </button>
      </div>
      <button
        type="button"
        onClick={() => onIncident(running)}
        className={`h-16 rounded-2xl text-lg font-medium tracking-wide ${running ? "incident-live border border-alarm bg-bg text-alarm" : "bg-alarm text-bg"}`}
      >
        {running ? `End incident ${fmtDur(elapsed)}` : "Incident"}
      </button>
      <button
        type="button"
        disabled={!running && !summary}
        onClick={() => getEngine().captureBaseline(45)}
        className="h-12 rounded-xl border border-line text-sm disabled:opacity-40"
      >
        {status && status.baselineRemainingSec > 0
          ? `Baseline ${Math.ceil(status.baselineRemainingSec)}s left`
          : "Capture quiet baseline · 45s"}
      </button>
      {summary?.summary ? (
        <div className="rounded-2xl border border-phosphor/40 bg-surface p-4">
          <p className="text-sm font-medium">Incident closed</p>
          <p className="nums mt-2 text-sm">
            {fmtDur(summary.summary.durationSec)} · LAeq {fmtDb(summary.summary.laeq)} · LCeq {fmtDb(summary.summary.lceq)} · LC−LA{" "}
            {fmtDb(summary.summary.lcMinusLa)}
          </p>
          <p className="mt-1 text-xs text-mist">
            LAmax,F {fmtDb(summary.summary.lafMax)} · LCpeak {fmtDb(summary.summary.lcPeak)} · clip rows {summary.summary.clippedRows}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="h-11 rounded-full bg-phosphor px-4 text-sm font-medium text-bg"
              onClick={() => void downloadIncident(summary)}
            >
              Export pack
            </button>
            <button type="button" className="h-11 rounded-full border border-line px-4 text-sm" onClick={onDismissSummary}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <p className="text-xs leading-relaxed text-pretty text-mist">
        {offset === 0
          ? "Showing dB relative to digital full scale. Same room, same gain: compare, don’t certify."
          : `Includes your ${offset.toFixed(1)} dB offset. Still not a certified sound pressure level.`}
      </p>
    </div>
  );
}

function Readout({
  label,
  value,
  offset,
  clipped,
  pale,
}: {
  label: string;
  value: number | undefined;
  offset: number;
  clipped?: boolean;
  pale?: boolean;
}) {
  const pct = levelPct(value ?? -160, offset);
  return (
    <div className={`rounded-2xl border bg-surface p-3 ${clipped ? "border-alarm" : "border-line"}`}>
      <p className="text-xs tracking-widest text-mist">{label}</p>
      <p className={`nums mt-1 text-5xl leading-none sm:text-6xl ${pale ? "text-fg" : "text-phosphor"}`}>{fmtDb(value)}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${clipped ? "bg-alarm" : pale ? "bg-fg" : "bg-phosphor"}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: number | undefined; emphasize?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-2 py-2">
      <p className="text-xs text-mist">{label}</p>
      <p className={`nums text-lg ${emphasize ? "text-phosphor" : ""}`}>{fmtDb(value)}</p>
    </div>
  );
}

function Slate({ onClose, onStart }: { onClose: () => void; onStart: (meta: IncidentMeta) => Promise<void> }) {
  const [meta, setMeta] = useState<IncidentMeta>({ ...EMPTY_META, room: "bedroom" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof IncidentMeta>(key: K, value: IncidentMeta[K]) => setMeta((m) => ({ ...m, [key]: value }));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 sm:items-center">
      <form
        className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-2xl border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void onStart(meta).finally(() => setBusy(false));
        }}
      >
        <h2 className="text-lg font-medium">Incident slate</h2>
        <p className="mt-1 text-xs text-mist">Your notes. Nothing here identifies a neighbor’s voice.</p>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Your name" value={meta.name} onChange={(v) => set("name", v)} />
          <Field label="Address / unit" value={meta.address} onChange={(v) => set("address", v)} />
          <Field label="Room" value={meta.room} onChange={(v) => set("room", v)} />
          <Select label="Windows" value={meta.windows} options={["open", "closed", "unknown"]} onChange={(v) => set("windows", v as IncidentMeta["windows"])} />
          <Select
            label="Perceived direction"
            value={meta.direction}
            options={["above", "below", "adjacent", "street", "inside", "unknown"]}
            onChange={(v) => set("direction", v as IncidentMeta["direction"])}
          />
          <Select
            label="Noise type"
            value={meta.noiseType}
            options={["music", "bass", "barking", "impact", "traffic", "mechanical", "other"]}
            onChange={(v) => set("noiseType", v as IncidentMeta["noiseType"])}
          />
          <label className="flex flex-col gap-1 text-sm">
            Note
            <textarea
              value={meta.note}
              onChange={(e) => set("note", e.target.value)}
              rows={3}
              className="rounded-xl border border-line bg-bg px-3 py-2 text-base"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="h-12 flex-1 rounded-xl border border-line" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className="h-12 flex-1 rounded-xl bg-alarm font-medium text-bg disabled:opacity-50">
            {busy ? "Starting…" : "Start incident"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-xl border border-line bg-bg px-3 text-base" />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-xl border border-line bg-bg px-3 text-base">
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

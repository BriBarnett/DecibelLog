import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DemoKind, FftSize, IncidentRecord } from "./engine/types.ts";

export type Screen = "meter" | "spectrum" | "spectrogram" | "logbook" | "settings" | "guide";

type Patch = {
  fftSize?: FftSize;
  levelsOnly?: boolean;
  stampLocation?: boolean;
  spectroSeconds?: 30 | 60 | 120;
  specColor?: "c" | "z";
  demoKind?: DemoKind;
  screenOnEstimate?: boolean;
  deviceKey?: string;
};

type LogState = {
  calByDevice: Record<string, number>;
  deviceKey: string;
  fftSize: FftSize;
  levelsOnly: boolean;
  stampLocation: boolean;
  spectroSeconds: 30 | 60 | 120;
  specColor: "c" | "z";
  demoKind: DemoKind;
  screenOnEstimate: boolean;
  incidents: IncidentRecord[];
  setCal: (key: string, offset: number) => void;
  patch: (partial: Patch) => void;
  saveIncident: (inc: IncidentRecord) => void;
  removeIncident: (id: string) => void;
};

function slim(list: IncidentRecord[]): IncidentRecord[] {
  return list.slice(0, 24).map((inc, index) => ({
    ...inc,
    samples: index < 3 ? inc.samples.slice(-4800) : [],
  }));
}

export const useLogbook = create<LogState>()(
  persist(
    (set) => ({
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
      setCal: (key, offset) =>
        set((s) => ({
          calByDevice: { ...s.calByDevice, [key]: Math.max(-20, Math.min(20, offset)) },
        })),
      patch: (partial) => set(partial),
      saveIncident: (inc) =>
        set((s) => ({
          incidents: slim([inc, ...s.incidents.filter((row) => row.id !== inc.id)]),
        })),
      removeIncident: (id) => set((s) => ({ incidents: s.incidents.filter((row) => row.id !== id) })),
    }),
    { name: "decibellog-v1" },
  ),
);

export function calKeyFor(mode: "demo" | "mic", deviceId: string | null): string {
  if (mode === "mic" && deviceId) return `mic:${deviceId}`;
  return "demo";
}

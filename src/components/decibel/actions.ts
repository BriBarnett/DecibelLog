import { buildEvidencePack, reportBody } from "@/lib/evidence/pack";
import { encodeWav16 } from "@/lib/evidence/wav";
import type { GeoStamp, IncidentMeta, IncidentRecord } from "@/lib/engine/types";
import {
  clearWav,
  getEngine,
  recallWav,
  rememberWav,
  setRetainAudio,
  takeWav,
  wasWavCapped,
} from "@/lib/engine/runtime";
import { useLogbook } from "@/lib/store";
import { downloadBytes } from "./format";

async function locate(): Promise<GeoStamp> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export async function beginIncident(meta: IncidentMeta): Promise<void> {
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

export function endIncident(): IncidentRecord | null {
  const inc = getEngine().stopIncident();
  if (!inc) return null;
  if (!inc.levelsOnly) {
    const capped = wasWavCapped();
    const pcm = takeWav();
    if (pcm) rememberWav(inc.id, encodeWav16(pcm, inc.device.sampleRate || 48_000));
    if (capped) {
      inc.events.push({
        kind: "incident-end",
        at: inc.endedAt ?? inc.startedAt,
        detail: "audio capped at 60 s",
      });
    }
  } else {
    clearWav();
  }
  useLogbook.getState().saveIncident(structuredClone(inc));
  return inc;
}

export async function downloadIncident(inc: IncidentRecord): Promise<void> {
  const pack = await buildEvidencePack(inc, recallWav(inc.id));
  downloadBytes(pack.filename, pack.bytes, "application/zip");
}

export async function copySummary(inc: IncidentRecord): Promise<void> {
  const text = reportBody(inc);
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
}

import type { IocalcTranscript, IocalcTranscriptEvent, IocalcTransport } from "./types.js";

export function createTranscript(transport: IocalcTransport): IocalcTranscript {
  return {
    transport,
    startedAt: new Date().toISOString(),
    events: []
  };
}

export function appendTranscriptEvent(
  transcript: IocalcTranscript,
  event: Omit<IocalcTranscriptEvent, "at">
): IocalcTranscript {
  return {
    ...transcript,
    events: [...transcript.events, { ...event, at: new Date().toISOString() }]
  };
}

export function completeTranscript(transcript: IocalcTranscript): IocalcTranscript {
  return {
    ...transcript,
    completedAt: new Date().toISOString()
  };
}

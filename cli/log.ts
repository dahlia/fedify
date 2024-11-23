import {
  configure,
  getConsoleSink,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";

export interface RecordingSink extends Sink {
  startRecording(): void;
  stopRecording(): void;
  getRecords(): LogRecord[];
}

export function getRecordingSink(): RecordingSink {
  let records: LogRecord[] = [];
  let recording = false;
  const sink: RecordingSink = (record: LogRecord) => {
    if (recording) records.push(record);
  };
  sink.startRecording = () => {
    records = [];
    recording = true;
  };
  sink.stopRecording = () => {
    recording = false;
  };
  sink.getRecords = () => [...records];
  return sink;
}

export const recordingSink = getRecordingSink();

await configure({
  sinks: { console: getConsoleSink(), recording: recordingSink },
  filters: {},
  loggers: [
    {
      category: "fedify",
      level: "debug",
      sinks: ["recording"],
    },
    {
      category: ["logtape", "meta"],
      level: "warning",
      sinks: ["console"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
  reset: true,
});

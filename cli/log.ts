import {
  configure,
  getConsoleSink,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";

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
      lowestLevel: "debug",
      sinks: ["recording"],
    },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
  reset: true,
});

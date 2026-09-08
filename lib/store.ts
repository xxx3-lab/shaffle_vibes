import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { HistoryEntry, Settings, Source } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  const filePath = path.join(DATA_DIR, file);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDir();
  const filePath = path.join(DATA_DIR, file);
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

export function uid(): string {
  return crypto.randomBytes(6).toString("hex");
}

// ===== Sources =====

export function getSources(): Source[] {
  return readJson<Source[]>("sources.json", []);
}

export function saveSources(sources: Source[]) {
  writeJson("sources.json", sources);
}

// ===== Settings =====

export const DEFAULT_SETTINGS: Settings = {
  aiHost: "c5.play2go.cloud",
  aiPort: 20132,
  aiModel: "deepseek-chat",
  aiTemperature: 0.92,
  aiMaxTokens: 900,
  minPostLength: 650,
  maxPostLength: 950,
  newsLimitPerSource: 5,
  similarityLimit: 0.72,
};

export function getSettings(): Settings {
  const stored = readJson<Partial<Settings>>("settings.json", {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings: Settings) {
  writeJson("settings.json", settings);
}

// ===== History =====

export function getHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>("history.json", []);
}

export function saveHistory(history: HistoryEntry[]) {
  writeJson("history.json", history);
}

export function addHistoryEntry(entry: HistoryEntry) {
  const history = getHistory();
  history.unshift(entry);
  saveHistory(history.slice(0, 500));
}

export function getSentGuids(): string[] {
  return readJson<string[]>("sent.json", []);
}

export function addSentGuid(guid: string) {
  const sent = getSentGuids();
  sent.push(guid);
  saveSentGuids(sent.slice(-2000));
}

function saveSentGuids(sent: string[]) {
  writeJson("sent.json", sent);
}

export function resetSentGuids() {
  saveSentGuids([]);
}

export interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}

export interface Settings {
  aiHost: string;
  aiPort: number;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  minPostLength: number;
  maxPostLength: number;
  newsLimitPerSource: number;
  similarityLimit: number;
  // YandexART — генерация картинок для пинов (ключ и каталог вводятся в Настройках)
  yaApiKey: string;
  yaFolderId: string;
  yaModel: string;
}

export interface NewsItem {
  sourceId: string;
  sourceName: string;
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
  imageUrl: string | null;
  author: string;
  categories: string[];
  isNew?: boolean;
}

export interface HistoryEntry {
  id: string;
  kind: "news" | "pin" | "author";
  title: string;
  sourceName: string;
  newsLink?: string;
  style?: string;
  postText: string;
  imageUrl?: string | null;
  remoteUrl?: string | null;
  posterUrl?: string | null;
  createdAt: string;
}

export interface GenerationResult {
  postText: string;
  style: string;
  attempts: number;
  usedFallback: boolean;
  imageUrl: string | null;
}

export interface PinResult {
  imageUrl: string;
  remoteUrl?: string | null;
  title: string;
  context: string;
  text: string;
  usedFallback: boolean;
}

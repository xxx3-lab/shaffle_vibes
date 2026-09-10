"use client";

import { useRef, useState } from "react";
import { Button, Chip, Input, Spinner, Textarea } from "@nextui-org/react";
import { AnimatePresence, motion } from "framer-motion";
import { PageShell, Rise } from "@/components/PageShell";
import type { PinResult } from "@/lib/types";

const THEMES = ["Успех", "Дисциплина", "Утро и кофе", "Спорт", "Продуктивность", "Спокойствие", "Бизнес"];

const MODES: { key: "phrase" | "speech" | "caption"; label: string; hint: string }[] = [
  { key: "phrase", label: "📌 Фраза", hint: "короткая хлёсткая фраза, как популярная цитата" },
  { key: "speech", label: "🎤 Речь", hint: "короткая речь на «ты», 3–5 предложений" },
  { key: "caption", label: "✍️ Подпись", hint: "1–2 предложения со свежей метафорой" },
];

const SIZES = [
  { key: "4:5", label: "4:5 Пост" },
  { key: "1:1", label: "1:1 Квадрат" },
  { key: "9:16", label: "9:16 Сторис" },
  { key: "16:9", label: "16:9 Обложка" },
];

const FONTS = [
  "Arial Black", "Impact", "Georgia", "Verdana",
  "Trebuchet MS", "Times New Roman", "Consolas", "Comic Sans MS",
];

export default function PinsPage() {
  const [links, setLinks] = useState("");
  const [prompts, setPrompts] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [theme, setTheme] = useState("");
  const [mode, setMode] = useState<"phrase" | "speech" | "caption">("phrase");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<
    (PinResult & {
      posterOpen?: boolean;
      size?: string;
      font?: string;
      variants?: { layout: string; label: string; posterUrl: string }[];
      variantsLoading?: boolean;
      activePoster?: string;
      textLoading?: boolean;
      color?: string;
    })[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    const linkList = links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const promptList = prompts
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    if (!linkList.length && !files.length && !promptList.length) {
      setErrors(["Вставьте ссылки, выберите файлы или опишите картинки для генерации"]);
      return;
    }

    setCreating(true);
    setErrors([]);
    setResults([]);

    try {
      const fd = new FormData();
      linkList.forEach((l) => fd.append("links", l));
      promptList.forEach((p) => fd.append("prompts", p));
      files.forEach((f) => fd.append("files", f));
      if (theme.trim()) fd.append("theme", theme.trim());
      fd.append("mode", mode);

      const res = await fetch("/api/pins", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setErrors(data.errors || []);
      setResults(
        (data.results || []).map((r: PinResult) => ({ ...r, posterLoading: false }))
      );
    } catch (e) {
      setErrors([String(e)]);
    } finally {
      setCreating(false);
    }
  };

  const makePoster = async (index: number) => {
    setResults((rs) =>
      rs.map((r, i) => (i === index ? { ...r, variantsLoading: true, posterOpen: true } : r))
    );
    try {
      const r = results[index];
      const res = await fetch("/api/poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: r.imageUrl,
          text: r.text,
          size: r.size || "4:5",
          font: r.font || "Arial Black",
          color: r.color || "#5e7031",
          theme,
          context: r.context,
          variants: true,
        }),
      });
      const data = await res.json();
      if (data.variants) {
        setResults((rs) =>
          rs.map((rr, i) =>
            i === index
              ? { ...rr, variants: data.variants, activePoster: data.variants[0]?.posterUrl }
              : rr
          )
        );
      } else {
        setErrors((es) => [...es, data.error || "Не удалось создать постеры"]);
      }
    } finally {
      setResults((rs) => rs.map((r, i) => (i === index ? { ...r, variantsLoading: false } : r)));
    }
  };

  const setPosterOpt = (index: number, patch: Record<string, unknown>) => {
    setResults((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const editText = (index: number, text: string) => {
    setResults((rs) => rs.map((r, i) => (i === index ? { ...r, text } : r)));
  };

  const regenText = async (index: number) => {
    setResults((rs) => rs.map((r, i) => (i === index ? { ...r, textLoading: true } : r)));
    try {
      const res = await fetch("/api/motivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          context: results[index].context,
          mode,
        }),
      });
      const data = await res.json();
      if (data.text) {
        setResults((rs) =>
          rs.map((r, i) =>
            i === index ? { ...r, text: data.text, usedFallback: data.usedFallback } : r
          )
        );
      }
    } finally {
      setResults((rs) => rs.map((r, i) => (i === index ? { ...r, textLoading: false } : r)));
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <PageShell
      title="ПИНЫ И ПОСТЕРЫ"
      accentWord="ПОСТЕРЫ"
      subtitle="Вставьте ссылки на пины, загрузите картинки или сгенерируйте новые по описанию (YandexART) — сайт напишет мотивационный текст и наложит его на постер."
    >
      <Rise>
        <div className="ink-card p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
                Ссылки (по одной на строку)
              </p>
              <Textarea
                minRows={4}
                placeholder={
                  "https://ru.pinterest.com/pin/123456789/\nhttps://i.pinimg.com/originals/...jpg\nhttps://example.com/photo.jpg"
                }
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                classNames={{ inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
              />
              <p className="mt-2 text-xs text-ink/40">
                Если пин не открывается — вставьте прямую ссылку на картинку (i.pinimg.com/...)
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
                  Или загрузите файлы
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-ink bg-white p-6 text-center"
                >
                  <p className="text-2xl">🖼️</p>
                  <p className="mt-1 text-sm font-medium">
                    {files.length ? `Выбрано файлов: ${files.length}` : "Выбрать картинки"}
                  </p>
                </motion.button>
                {files.length > 0 && (
                  <p className="mt-1 truncate text-xs text-ink/40">
                    {files.map((f) => f.name).join(", ")}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
                  Или сгенерируйте картинки по описанию (YandexART)
                </p>
                <Textarea
                  minRows={2}
                  maxRows={4}
                  placeholder={
                    "Каждая строка — отдельная картинка:\nуютное утро, кофе у окна, мягкий свет\nзакат в горах, вдохновляющий пейзаж"
                  }
                  value={prompts}
                  onChange={(e) => setPrompts(e.target.value)}
                  classNames={{ inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
                />
                <p className="mt-2 text-xs text-ink/40">
                  Нужен API-ключ Yandex Cloud — он задаётся в Настройках. Генерация одной картинки
                  занимает до минуты.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
                  Тема мотивации
                </p>
                <Input
                  placeholder="Например: утро, дисциплина, большая цель..."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  classNames={{ inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {THEMES.map((t) => (
                    <Chip
                      key={t}
                      as="button"
                      onClick={() => setTheme(t)}
                      variant="flat"
                      className={`cursor-pointer border-2 border-ink/10 ${
                        theme === t ? "bg-lime font-bold" : "bg-white"
                      }`}
                    >
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
                  Формат текста
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map((m) => (
                    <Chip
                      key={m.key}
                      as="button"
                      onClick={() => setMode(m.key)}
                      variant="flat"
                      className={`cursor-pointer border-2 border-ink/10 ${
                        mode === m.key ? "bg-accent font-bold text-white" : "bg-white"
                      }`}
                    >
                      {m.label}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink/40">
                  {MODES.find((m) => m.key === mode)?.hint}
                </p>
              </div>

              <Button
                onPress={create}
                isLoading={creating}
                className="btn-ink shimmer self-start px-8 py-5 text-base"
              >
                {creating ? "Колдую..." : "✨ Создать пины"}
              </Button>
            </div>
          </div>
        </div>
      </Rise>

      {errors.length > 0 && (
        <Rise className="mt-4">
          <div className="rounded-2xl border-2 border-danger/40 bg-danger/5 p-3">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-danger">⚠ {e}</p>
            ))}
          </div>
        </Rise>
      )}

      {creating && (
        <Rise className="mt-6">
          <div className="flex flex-col items-center gap-3 py-10">
            <motion.div
              className="text-5xl"
              animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              ✳
            </motion.div>
            <p className="text-sm text-ink/60">Скачиваем картинки, зовём AI...</p>
          </div>
        </Rise>
      )}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 grid gap-6 md:grid-cols-2"
          >
            {results.map((r, i) => (
              <motion.div
                key={r.imageUrl + i}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                className="ink-card overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="max-h-72 w-full border-b-2 border-ink object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
                <div className="space-y-3 p-5">
                  <p className="truncate text-xs font-bold uppercase tracking-widest text-ink/40">
                    {r.title}
                    {r.usedFallback && " · fallback"}
                  </p>
                  <Textarea
                    value={r.text}
                    onChange={(e) => editText(i, e.target.value)}
                    minRows={2}
                    classNames={{ inputWrapper: "border-2 border-ink bg-paper" }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onPress={() => makePoster(i)}
                      isLoading={r.variantsLoading}
                      className="btn-accent px-4"
                    >
                      🎨 Постер: 5 вариантов
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => regenText(i)}
                      isLoading={r.textLoading}
                      className="border-2 border-ink"
                    >
                      ⟳ Другой текст
                    </Button>
                    <Button size="sm" variant="flat" onPress={() => copy(r.text)} className="border-2 border-ink">
                      📋 Текст
                    </Button>
                    {r.remoteUrl && (
                      <a href={r.remoteUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="flat" className="border-2 border-ink">
                          🔗 Внешняя ссылка
                        </Button>
                      </a>
                    )}
                  </div>
                  {r.remoteUrl && (
                    <p className="text-[11px] text-ink/40">
                      Картинка также загружена на catbox.moe — ссылку можно вставлять куда угодно.
                    </p>
                  )}

                  <AnimatePresence>
                    {r.posterOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 rounded-xl border-2 border-ink bg-paper p-3">
                          <div className="flex flex-col gap-3 md:flex-row">
                            <div>
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink/40">
                                Размер
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {SIZES.map((s) => (
                                  <Chip
                                    key={s.key}
                                    as="button"
                                    size="sm"
                                    onClick={() => setPosterOpt(i, { size: s.key })}
                                    variant="flat"
                                    className={`cursor-pointer border-2 border-ink/10 ${
                                      (r.size || "4:5") === s.key ? "bg-ink font-bold text-paper" : "bg-white"
                                    }`}
                                  >
                                    {s.label}
                                  </Chip>
                                ))}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink/40">
                                Шрифт
                              </p>
                              <select
                                value={r.font || "Arial Black"}
                                onChange={(e) => setPosterOpt(i, { font: e.target.value })}
                                className="w-full rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm outline-none"
                              >
                                {FONTS.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink/40">
                              Цвет заголовка (для мем-постера)
                            </p>
                            <div className="flex gap-2">
                              {[
                                { c: "#5e7031", name: "олива" },
                                { c: "#5b2ee5", name: "фиолет" },
                                { c: "#141312", name: "чернила" },
                                { c: "#8a3324", name: "терракота" },
                                { c: "#1f5f5b", name: "хвоя" },
                              ].map((s) => (
                                <motion.button
                                  key={s.c}
                                  whileHover={{ scale: 1.12 }}
                                  onClick={() => setPosterOpt(i, { color: s.c })}
                                  title={s.name}
                                  className={`h-7 w-7 rounded-full border-2 ${
                                    (r.color || "#5e7031") === s.c
                                      ? "border-ink shadow-[2px_2px_0_#141312]"
                                      : "border-ink/20"
                                  }`}
                                  style={{ background: s.c }}
                                />
                              ))}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onPress={() => makePoster(i)}
                            isLoading={r.variantsLoading}
                            className="btn-ink w-full"
                          >
                            ⟳ Пересобрать варианты с этими настройками
                          </Button>

                          {r.variants && (
                            <div className="grid grid-cols-5 gap-2">
                              {r.variants.map((v) => (
                                <motion.button
                                  key={v.layout}
                                  whileHover={{ y: -3 }}
                                  onClick={() => setPosterOpt(i, { activePoster: v.posterUrl })}
                                  className={`overflow-hidden rounded-lg border-2 ${
                                    r.activePoster === v.posterUrl
                                      ? "border-accent shadow-[3px_3px_0_#5b2ee5]"
                                      : "border-ink"
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={v.posterUrl} alt={v.label} className="h-20 w-full object-cover" />
                                  <p className="bg-white py-0.5 text-center text-[9px] font-bold uppercase">
                                    {v.label}
                                  </p>
                                </motion.button>
                              ))}
                            </div>
                          )}

                          {r.activePoster && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={r.activePoster}
                                alt="Постер"
                                className="mx-auto max-h-96 rounded-lg border-2 border-ink"
                              />
                              <div className="flex justify-center gap-2">
                                <a href={r.activePoster} target="_blank" rel="noreferrer">
                                  <Button size="sm" className="btn-ink px-4">
                                    ⬇ Открыть / скачать
                                  </Button>
                                </a>
                                <Button size="sm" variant="flat" onPress={() => copy(r.text)} className="border-2 border-ink">
                                  📋 Текст
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {r.variantsLoading && (
                    <div className="flex justify-center py-4">
                      <Spinner color="secondary" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

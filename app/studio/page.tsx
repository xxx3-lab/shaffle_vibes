"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Chip, Input, Select, SelectItem, Spinner, Tooltip } from "@nextui-org/react";
import { AnimatePresence, motion } from "framer-motion";
import { PageShell, Rise } from "@/components/PageShell";
import { STYLE_SEQUENCE, STYLE_LABELS_RU } from "@/lib/content";
import type { NewsItem } from "@/lib/types";

interface Generation {
  postText: string;
  style: string;
  usedFallback: boolean;
  imageUrl: string | null;
}

interface AuthorResult extends Generation {
  imageSourceUrl: string | null;
  imageTitle: string;
  keywords: string;
  topic: string;
}

export default function StudioPage() {
  const [tab, setTab] = useState<"news" | "author">("news");

  // === Режим «Из новости» ===
  const [news, setNews] = useState<NewsItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("Все");
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const [style, setStyle] = useState<string>("auto");
  const [generating, setGenerating] = useState(false);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState("");

  // === Режим «Авторский пост» ===
  const [topic, setTopic] = useState("");
  const [authorStyle, setAuthorStyle] = useState("auto");
  const [authorLoading, setAuthorLoading] = useState(false);
  const [author, setAuthor] = useState<AuthorResult | null>(null);
  const [imageOffset, setImageOffset] = useState(0);
  const [imgSwapping, setImgSwapping] = useState(false);
  const [authorError, setAuthorError] = useState("");

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    const data = await fetch("/api/news").then((r) => r.json());
    setNews(data.news || []);
    setErrors(data.errors || []);
    setLoadingNews(false);
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const sourceNames = useMemo(
    () => ["Все", ...Array.from(new Set(news.map((n) => n.sourceName)))],
    [news]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return news.filter(
      (n) =>
        (sourceFilter === "Все" || n.sourceName === sourceFilter) &&
        (!q || n.title.toLowerCase().includes(q) || n.sourceName.toLowerCase().includes(q))
    );
  }, [news, query, sourceFilter]);

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    setGeneration(null);
    setGenError("");
    setCopied(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news: selected, style: style === "auto" ? undefined : style }),
      });
      const data = await res.json();
      if (data.error) setGenError(data.error);
      else setGeneration(data);
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const generateAuthor = async () => {
    if (!topic.trim()) {
      setAuthorError("Введите тему поста");
      return;
    }
    setAuthorLoading(true);
    setAuthor(null);
    setAuthorError("");
    setCopied(false);
    try {
      const res = await fetch("/api/author", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), style: authorStyle === "auto" ? undefined : authorStyle }),
      });
      const data = await res.json();
      if (data.error) setAuthorError(data.error);
      else {
        setAuthor({ ...data, topic: topic.trim() });
        setImageOffset(0);
      }
    } catch (e) {
      setAuthorError(String(e));
    } finally {
      setAuthorLoading(false);
    }
  };

  const swapImage = async () => {
    if (!author?.keywords) return;
    setImgSwapping(true);
    try {
      const next = imageOffset + 6;
      const res = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: author.keywords, offset: next }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setAuthor((a) =>
          a
            ? {
                ...a,
                imageUrl: data.imageUrl,
                imageSourceUrl: data.imageSourceUrl,
                imageTitle: data.imageTitle,
              }
            : a
        );
        setImageOffset(next);
      } else {
        setAuthorError(data.error || "Не нашлось другой картинки");
      }
    } finally {
      setImgSwapping(false);
    }
  };

  const copy = async (text: string) => {
    const plain = text.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputCls = { inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" };
  const shown = tab === "news" ? generation : author;

  return (
    <PageShell
      title="СТУДИЯ ПОСТОВ"
      accentWord="ПОСТОВ"
      subtitle="Пост из новости или авторский материал на любую тему — с подходящей картинкой. Ничего никуда не отправляется."
    >
      {/* Табы */}
      <Rise className="mb-6 flex gap-2">
        {[
          { key: "news" as const, label: "📰 Из новости" },
          { key: "author" as const, label: "✍️ Авторский пост" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative rounded-full border-2 border-ink px-5 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "text-paper" : "bg-white text-ink hover:bg-lime/50"
            }`}
          >
            {tab === t.key && (
              <motion.span layoutId="studio-tab" className="absolute inset-0 rounded-full bg-ink" />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </Rise>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Левая колонка */}
        <Rise className="lg:col-span-2">
          <div className="ink-card p-4">
            {tab === "news" ? (
              <>
                <div className="mb-3 flex gap-2">
                  <Input
                    size="sm"
                    placeholder="Поиск по новостям..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    classNames={inputCls}
                  />
                  <Button isIconOnly size="sm" variant="flat" onPress={loadNews} isLoading={loadingNews} className="border-2 border-ink">
                    ⟳
                  </Button>
                </div>

                {/* Фильтр по источникам */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {sourceNames.map((s) => (
                    <Chip
                      key={s}
                      as="button"
                      onClick={() => setSourceFilter(s)}
                      size="sm"
                      variant="flat"
                      className={`cursor-pointer border-2 border-ink/10 ${
                        sourceFilter === s ? "bg-accent font-bold text-white" : "bg-white"
                      }`}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>

                {errors.length > 0 && (
                  <div className="mb-3 rounded-xl border-2 border-warning/50 bg-warning/10 p-2">
                    {errors.slice(0, 3).map((e, i) => (
                      <p key={i} className="text-[11px] text-warning-600">⚠ {e}</p>
                    ))}
                  </div>
                )}

                {loadingNews ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="lg" color="secondary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink/40">
                    Новостей нет. Добавьте источники или смените фильтр.
                  </p>
                ) : (
                  <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {filtered.map((n) => (
                      <motion.button
                        key={n.guid}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelected(n)}
                        className={`w-full rounded-xl p-3 text-left transition-colors ${
                          selected?.guid === n.guid
                            ? "bg-accent text-white shadow-[4px_4px_0_#141312]"
                            : "bg-paper hover:bg-lime/40"
                        }`}
                      >
                        <span
                          className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            selected?.guid === n.guid ? "bg-white/20 text-white" : "bg-ink text-paper"
                          }`}
                        >
                          {n.sourceName}
                        </span>
                        <p className="line-clamp-2 text-sm font-medium">{n.title}</p>
                        <p className={`mt-1 line-clamp-2 text-xs ${selected?.guid === n.guid ? "text-white/70" : "text-ink/40"}`}>
                          {n.description}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="font-display text-base font-bold uppercase">
                  О чём пишем?
                </p>
                <Input
                  label="Тема поста"
                  placeholder="Например: почему прокрастинация — это не лень"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  classNames={inputCls}
                />
                <Select
                  label="Стиль"
                  selectedKeys={[authorStyle]}
                  onChange={(e) => setAuthorStyle(e.target.value)}
                  size="sm"
                  classNames={{ trigger: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
                >
                  {["auto", ...STYLE_SEQUENCE].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "auto" ? "🎲 Авто (по кругу)" : STYLE_LABELS_RU[s]}
                    </SelectItem>
                  ))}
                </Select>
                <div className="rounded-xl bg-paper p-3 text-xs leading-relaxed text-ink/50">
                  AI напишет авторский материал на вашу тему, а картинку подберёт по смыслу из
                  открытой библиотеки Wikimedia Commons (свободные лицензии).
                </div>
              </div>
            )}
          </div>
        </Rise>

        {/* Правая колонка */}
        <Rise className="lg:col-span-3">
          <div className="ink-card p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              {tab === "news" ? (
                <>
                  <Select
                    label="Стиль поста"
                    selectedKeys={[style]}
                    onChange={(e) => setStyle(e.target.value)}
                    className="flex-1"
                    size="sm"
                    classNames={{ trigger: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
                  >
                    {["auto", ...STYLE_SEQUENCE].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "auto" ? "🎲 Авто (по кругу)" : STYLE_LABELS_RU[s]}
                      </SelectItem>
                    ))}
                  </Select>
                  <Button
                    onPress={generate}
                    isDisabled={!selected}
                    isLoading={generating}
                    className="btn-ink shimmer px-6 py-5"
                  >
                    ✨ Сгенерировать
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1 text-sm text-ink/60">
                    {topic ? (
                      <>Тема: <b>«{topic}»</b></>
                    ) : (
                      "Введите тему слева — и жмите кнопку"
                    )}
                  </div>
                  <Button
                    onPress={generateAuthor}
                    isDisabled={!topic.trim()}
                    isLoading={authorLoading}
                    className="btn-ink shimmer px-6 py-5"
                  >
                    ✨ Написать пост
                  </Button>
                </>
              )}
            </div>

            {tab === "news" && selected && (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl bg-paper p-3">
                <p className="text-sm font-semibold">{selected.title}</p>
                <p className="mt-1 line-clamp-3 text-xs text-ink/50">{selected.description}</p>
                <a href={selected.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
                  Открыть источник →
                </a>
              </motion.div>
            )}

            {(generating || authorLoading) && (
              <div className="flex flex-col items-center gap-3 py-12">
                <motion.div
                  className="text-5xl"
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  ✳
                </motion.div>
                <p className="text-sm text-ink/60">
                  {authorLoading ? "AI пишет и подбирает картинку..." : "AI пишет пост... (до 3 попыток ради уникальности)"}
                </p>
              </div>
            )}

            {genError && !(generating || authorLoading) && <p className="mt-4 text-sm text-danger">{genError}</p>}
            {authorError && !(generating || authorLoading) && <p className="mt-4 text-sm text-danger">{authorError}</p>}

            <AnimatePresence>
              {shown && !(generating || authorLoading) && (
                <motion.div
                  key="gen"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Chip size="sm" className="border-2 border-ink bg-lime font-bold">
                      {tab === "author" ? "авторское" : (STYLE_LABELS_RU[shown.style] || shown.style)}
                    </Chip>
                    <Chip size="sm" variant="flat">
                      {shown.postText.replace(/<[^>]+>/g, "").length} символов
                    </Chip>
                    {shown.usedFallback && (
                      <Tooltip content="AI недоступен — текст собран из шаблона">
                        <Chip size="sm" variant="flat" color="warning">
                          fallback
                        </Chip>
                      </Tooltip>
                    )}
                  </div>

                  {shown.imageUrl && (
                    <motion.div layout>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <motion.img
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={shown.imageUrl}
                        alt=""
                        className="mb-2 max-h-64 w-full rounded-xl border-2 border-ink object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink/40">
                        {tab === "author" && (
                          <>
                            <Button size="sm" variant="flat" onPress={swapImage} isLoading={imgSwapping} className="h-7 min-w-0 border-2 border-ink px-2 text-xs">
                              🔄 Другая картинка
                            </Button>
                            {author?.imageSourceUrl && (
                              <a href={author.imageSourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                {author.imageTitle || "источник картинки"} (Wikimedia Commons) →
                              </a>
                            )}
                          </>
                        )}
                        {tab === "news" && (
                          <a href={shown.imageUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                            Открыть картинку →
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {tab === "author" && !shown.imageUrl && (
                    <p className="mb-4 rounded-xl border-2 border-warning/40 bg-warning/10 p-2 text-xs text-warning-700">
                      Картинку подобрать не удалось — попробуйте «Сгенерировать» ещё раз или смените тему.
                    </p>
                  )}

                  <div className="rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0_#141312]">
                    <div className="post-preview text-sm" dangerouslySetInnerHTML={{ __html: shown.postText }} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onPress={() => copy(shown.postText)} className="btn-accent px-6">
                      {copied ? "✓ Скопировано!" : "📋 Скопировать текст"}
                    </Button>
                    {tab === "news" && (
                      <Button variant="flat" onPress={generate} isLoading={generating} className="border-2 border-ink">
                        ⟳ Другой вариант
                      </Button>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-ink/40">✓ Пост автоматически сохранён в историю</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!shown && !(generating || authorLoading) && (
              <div className="flex flex-col items-center py-14 text-center">
                <motion.p className="text-5xl" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                  {tab === "news" ? "✍️" : "💡"}
                </motion.p>
                <p className="mt-3 text-sm text-ink/50">
                  {tab === "news"
                    ? "Выберите новость слева и нажмите «Сгенерировать»"
                    : "Введите тему и нажмите «Написать пост»"}
                </p>
              </div>
            )}
          </div>
        </Rise>
      </div>
    </PageShell>
  );
}

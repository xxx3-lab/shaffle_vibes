"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Chip } from "@nextui-org/react";
import { AnimatePresence, motion } from "framer-motion";
import { PageShell, Rise } from "@/components/PageShell";
import { STYLE_LABELS_RU } from "@/lib/content";
import type { HistoryEntry } from "@/lib/types";

type Filter = "all" | "news" | "pin" | "author";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const data = await fetch("/api/history").then((r) => r.json());
    setHistory(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clear = async () => {
    setLoading(true);
    await fetch("/api/history", { method: "DELETE" });
    await load();
  };

  const filtered = history.filter((h) => filter === "all" || h.kind === filter);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Всё" },
    { key: "news", label: "Новости" },
    { key: "pin", label: "Пины" },
    { key: "author", label: "Авторские" },
  ];

  return (
    <PageShell
      title="АРХИВ"
      accentWord="ХИВ"
      subtitle="Все сгенерированные посты и пины. Ничего не публикуется — просто берите и используйте."
      // кнопка очистки выведена ниже
    >
      <Rise className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative rounded-full border-2 border-ink px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? "text-paper" : "bg-white text-ink hover:bg-lime/50"
              }`}
            >
              {filter === f.key && (
                <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-ink" />
              )}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <Button size="sm" variant="flat" color="danger" onPress={clear} className="border-2 border-ink">
            🗑 Очистить всё
          </Button>
        )}
      </Rise>

      <div className="mt-6 grid gap-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink/40">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <Rise>
            <div className="ink-card flex flex-col items-center p-10 text-center">
              <motion.p className="text-5xl" animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                🗂
              </motion.p>
              <p className="mt-3 font-semibold">Здесь пока пусто</p>
              <p className="text-sm text-ink/50">Сгенерируйте пост в «Студии» или создайте пины</p>
            </div>
          </Rise>
        ) : (
          <AnimatePresence>
            {filtered.map((h) => (
              <motion.div
                key={h.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="ink-card flex flex-col gap-3 p-4 md:flex-row md:items-start">
                  {h.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={h.imageUrl}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl border-2 border-ink object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{h.title}</p>
                    <p className="text-xs text-ink/40">
                      {h.kind === "pin" ? "✳ пин" : h.sourceName} ·{" "}
                      {new Date(h.createdAt).toLocaleString("ru")}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/60">
                      {h.postText.replace(/<[^>]+>/g, "").slice(0, 180)}...
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {h.kind === "news" && h.style && (
                      <Chip size="sm" className="border-2 border-ink bg-lime font-bold">
                        {STYLE_LABELS_RU[h.style] || h.style}
                      </Chip>
                    )}
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setOpenId(openId === h.id ? null : h.id)}
                      className="border-2 border-ink"
                    >
                      {openId === h.id ? "Свернуть" : "Открыть"}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {openId === h.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="ink-card mt-2 ml-0 p-5 md:ml-8">
                        <div
                          className="post-preview text-sm"
                          dangerouslySetInnerHTML={{ __html: h.postText }}
                        />
                        {h.newsLink && (
                          <a
                            href={h.newsLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
                          >
                            Источник →
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </PageShell>
  );
}

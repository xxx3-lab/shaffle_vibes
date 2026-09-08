"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Chip, Progress, ScrollShadow, Spinner } from "@nextui-org/react";
import { motion, animate, AnimatePresence } from "framer-motion";
import { PageShell, Rise } from "@/components/PageShell";
import { STYLE_SEQUENCE, STYLE_LABELS_RU } from "@/lib/content";
import type { HistoryEntry, Source } from "@/lib/types";

interface CycleResult {
  generated: number;
  errors: string[];
  results: {
    newsTitle: string;
    sourceName: string;
    style: string;
    usedFallback: boolean;
    imageUrl: string | null;
    error?: string;
  }[];
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return <span ref={ref}>0</span>;
}

export default function DashboardPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<CycleResult | null>(null);
  const [maxItems, setMaxItems] = useState("3");

  const refresh = useCallback(async () => {
    const [s, h] = await Promise.all([
      fetch("/api/sources").then((r) => r.json()),
      fetch("/api/history").then((r) => r.json()),
    ]);
    setSources(s);
    setHistory(h);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runCycle = async () => {
    setRunning(true);
    setResult(null);
    setLog(["✳ Запускаем магию..."]);
    try {
      const res = await fetch("/api/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxItems: Number(maxItems) || 3 }),
      });
      const data = await res.json();
      if (data.error) {
        setLog((l) => [...l, `✖ ${data.error}`]);
      } else {
        setResult(data);
        setLog((l) => [...l, `✓ Готово: подготовлено постов — ${data.generated}`]);
        data.errors?.forEach((e: string) => setLog((l) => [...l, `⚠ ${e}`]));
      }
      refresh();
    } catch (e) {
      setLog((l) => [...l, `✖ ${String(e)}`]);
    } finally {
      setRunning(false);
    }
  };

  const activeSources = sources.filter((s) => s.enabled).length;
  const pinCount = history.filter((h) => h.kind === "pin").length;

  const stats = [
    { label: "Источники", value: activeSources, suffix: ` / ${sources.length}` },
    { label: "Постов создано", value: history.filter((h) => h.kind === "news").length, suffix: "" },
    { label: "Пинов создано", value: pinCount, suffix: "" },
    { label: "Стилей", value: STYLE_SEQUENCE.length, suffix: "" },
  ];

  return (
    <PageShell
      title="НОВОСТИ СТАНОВЯТСЯ ПОСТАМИ"
      accentWord="ПОСТАМИ"
      subtitle="Сайт парсит ваши RSS-источники, пишет уникальные посты с картинками через AI и собирает мотивационные пины. Никуда не постит — вы решаете, что делать с результатом."
    >
      {/* Постер-герой */}
      <Rise className="ink-card ink-card-hover relative overflow-hidden p-8 md:p-12">
        <motion.div
          className="absolute -right-8 -top-8 font-display text-[10rem] font-black text-accent/10 md:text-[16rem]"
          animate={{ rotate: [0, 8, -6, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        >
          ✳
        </motion.div>
        <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-ink/40">
          Генератор №1
        </p>
        <div className="mt-4 flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-lg font-bold md:text-2xl">
              Полный цикл: спарсить → написать → приложить картинку
            </p>
            <p className="mt-1 text-sm text-ink/60">
              Результаты попадают в историю. Публикация — на вашей совести.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={maxItems}
              onChange={(e) => setMaxItems(e.target.value.replace(/\D/g, ""))}
              className="w-16 rounded-full border-2 border-ink bg-white px-4 py-3 text-center font-bold outline-none focus:shadow-[4px_4px_0_#5b2ee5]"
              aria-label="Постов за цикл"
            />
            <Button
              onPress={runCycle}
              isLoading={running}
              className="btn-ink shimmer px-8 py-6 text-lg"
            >
              {running ? "Магия работает..." : "▶ Запустить цикл"}
            </Button>
          </div>
        </div>
        {running && <Progress size="sm" isIndeterminate color="secondary" className="mt-4" />}

        <AnimatePresence>
          {log.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ScrollShadow className="mt-4 max-h-36 rounded-xl bg-paper p-4">
                {log.map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-mono text-xs text-ink/70"
                  >
                    {line}
                  </motion.p>
                ))}
              </ScrollShadow>
            </motion.div>
          )}
        </AnimatePresence>

        {result && result.results.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {result.results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/10 bg-paper p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.newsTitle}</p>
                  <p className="text-xs text-ink/50">
                    {r.sourceName} · {STYLE_LABELS_RU[r.style] || r.style}
                  </p>
                </div>
                <Chip size="sm" variant="flat" color={r.usedFallback ? "warning" : "success"}>
                  {r.usedFallback ? "fallback" : "готов"}
                </Chip>
              </motion.div>
            ))}
          </div>
        )}
      </Rise>

      {/* Статистика */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Rise key={s.label}>
            <div className="ink-card ink-card-hover p-5">
              <p className="font-display text-4xl font-black">
                <CountUp value={s.value} />
                <span className="text-lg text-ink/40">{s.suffix}</span>
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-ink/50">{s.label}</p>
            </div>
          </Rise>
        ))}
      </div>

      {/* Бегущая строка стилей */}
      <Rise className="mt-6">
        <div className="marquee rounded-2xl border-2 border-ink bg-lime py-3">
          <div className="marquee-track font-display text-sm font-bold uppercase tracking-widest">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex gap-10">
                {STYLE_SEQUENCE.map((s) => (
                  <span key={s}>✳ {STYLE_LABELS_RU[s]}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </Rise>

      {/* Последние посты */}
      <Rise className="mt-6">
        <div className="ink-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold uppercase">Свежее из истории</h3>
            {history.length > 0 && (
              <Chip size="sm" variant="flat">
                {history.length} записей
              </Chip>
            )}
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <motion.p
                className="text-5xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                ✳
              </motion.p>
              <p className="mt-3 text-sm text-ink/50">
                Пока пусто. Запустите цикл или откройте «Студию».
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {history.slice(0, 5).map((h) => (
                <motion.div
                  key={h.id}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.title}</p>
                    <p className="text-xs text-ink/40">
                      {h.kind === "pin" ? "пин" : h.sourceName} ·{" "}
                      {new Date(h.createdAt).toLocaleString("ru")}
                    </p>
                  </div>
                  {h.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={h.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg border-2 border-ink object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Rise>

      {running && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-lime text-2xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          >
            <Spinner size="sm" />
          </motion.div>
        </div>
      )}
    </PageShell>
  );
}

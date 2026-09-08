"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Chip, Input, Switch } from "@nextui-org/react";
import { AnimatePresence, motion } from "framer-motion";
import { PageShell, Rise } from "@/components/PageShell";
import type { Source } from "@/lib/types";

const PRESETS = [
  { name: "Habr", url: "https://habr.com/ru/rss/all/?fl=ru" },
  { name: "Habr — AI", url: "https://habr.com/ru/rss/flows/ai/?fl=ru" },
  { name: "Lenta.ru", url: "https://lenta.ru/rss/news" },
  { name: "RIA", url: "https://ria.ru/export/rss2/archive/index.xml" },
];

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/sources").then((r) => r.json());
    setSources(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (presetName?: string, presetUrl?: string) => {
    const finalName = presetName ?? name;
    const finalUrl = presetUrl ?? url;
    if (!finalUrl) {
      setError("Укажите URL RSS-ленты");
      return;
    }
    setAdding(true);
    setError("");
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: finalName, url: finalUrl }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ошибка добавления");
    } else {
      if (!presetUrl) {
        setName("");
        setUrl("");
      }
      await load();
    }
    setAdding(false);
  };

  const toggle = async (s: Source, enabled: boolean) => {
    await fetch(`/api/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <PageShell
      title="ИСТОЧНИКИ"
      accentWord="НИКИ"
      subtitle="RSS-ленты, из которых сайт берёт новости. Включайте только нужные."
    >
      <Rise>
        <div className="ink-card p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              label="Название"
              placeholder="Habr"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:max-w-52"
              classNames={{ inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
            />
            <Input
              label="URL RSS"
              placeholder="https://example.com/rss"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              classNames={{ inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" }}
            />
            <Button onPress={() => add()} isLoading={adding} className="btn-ink px-6 md:mt-6">
              + Добавить
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink/40">Быстро:</span>
            {PRESETS.map((p) => (
              <Chip
                key={p.url}
                as="button"
                onClick={() => add(p.name, p.url)}
                variant="flat"
                className="cursor-pointer border-2 border-ink bg-white hover:bg-lime"
              >
                + {p.name}
              </Chip>
            ))}
          </div>
        </div>
      </Rise>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <AnimatePresence>
          {sources.map((s) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -3 }}
            >
              <div className="ink-card flex items-center gap-3 p-4">
                <Switch
                  size="sm"
                  color="secondary"
                  isSelected={s.enabled}
                  onValueChange={(v) => toggle(s, v)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-ink/40">{s.url}</p>
                </div>
                <Chip size="sm" variant="flat" color={s.enabled ? "success" : "default"}>
                  {s.enabled ? "вкл" : "выкл"}
                </Chip>
                <Button size="sm" variant="flat" color="danger" onPress={() => remove(s.id)}>
                  ✕
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {sources.length === 0 && (
        <Rise className="mt-6">
          <div className="ink-card flex flex-col items-center p-10 text-center">
            <motion.p className="text-5xl" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              📡
            </motion.p>
            <p className="mt-3 font-semibold">Источников пока нет</p>
            <p className="text-sm text-ink/50">Добавьте RSS или нажмите пресет выше</p>
          </div>
        </Rise>
      )}
    </PageShell>
  );
}

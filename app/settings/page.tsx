"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@nextui-org/react";
import { PageShell, Rise } from "@/components/PageShell";

interface SettingsForm {
  aiHost: string;
  aiPort: number;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  minPostLength: number;
  maxPostLength: number;
  newsLimitPerSource: number;
  similarityLimit: number;
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiResult, setAiResult] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/settings").then((r) => r.json());
    setForm(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof SettingsForm, value: string | number) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    load();
  };

  const testAi = async () => {
    setTestingAi(true);
    setAiResult("");
    const data = await fetch("/api/test/ai", { method: "POST" }).then((r) => r.json());
    setAiResult(data.ok ? `✓ AI отвечает: «${data.reply}»` : `✖ ${data.error}`);
    setTestingAi(false);
  };

  if (!form) {
    return (
      <div className="flex justify-center py-20 text-sm text-ink/40">Загрузка...</div>
    );
  }

  const num = (v: string) => (v === "" ? 0 : Number(v));
  const inputCls = { inputWrapper: "border-2 border-ink bg-white shadow-[3px_3px_0_#141312]" };

  return (
    <PageShell
      title="НАСТРОЙКИ"
      accentWord="РОЙКИ"
      subtitle="AI-подключение и параметры генерации постов"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Rise>
          <div className="ink-card h-full p-6">
            <h3 className="font-display text-lg font-bold uppercase">🤖 AI</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input
                label="Host"
                value={form.aiHost}
                onChange={(e) => set("aiHost", e.target.value)}
                size="sm"
                classNames={inputCls}
              />
              <Input
                label="Port"
                value={String(form.aiPort)}
                onChange={(e) => set("aiPort", num(e.target.value.replace(/\D/g, "")))}
                size="sm"
                classNames={inputCls}
              />
            </div>
            <Input
              className="mt-3"
              label="Модель"
              value={form.aiModel}
              onChange={(e) => set("aiModel", e.target.value)}
              size="sm"
              classNames={inputCls}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input
                label="Temperature"
                value={String(form.aiTemperature)}
                onChange={(e) => set("aiTemperature", num(e.target.value))}
                size="sm"
                classNames={inputCls}
              />
              <Input
                label="Max tokens"
                value={String(form.aiMaxTokens)}
                onChange={(e) => set("aiMaxTokens", num(e.target.value.replace(/\D/g, "")))}
                size="sm"
                classNames={inputCls}
              />
            </div>
            <Button
              size="sm"
              variant="flat"
              isLoading={testingAi}
              onPress={testAi}
              className="mt-4 border-2 border-ink"
            >
              Проверить AI
            </Button>
            {aiResult && <p className="mt-3 text-sm">{aiResult}</p>}
          </div>
        </Rise>

        <Rise>
          <div className="ink-card h-full p-6">
            <h3 className="font-display text-lg font-bold uppercase">✍️ Генерация</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input
                label="Мин. длина поста"
                value={String(form.minPostLength)}
                onChange={(e) => set("minPostLength", num(e.target.value.replace(/\D/g, "")))}
                size="sm"
                classNames={inputCls}
              />
              <Input
                label="Макс. длина поста"
                value={String(form.maxPostLength)}
                onChange={(e) => set("maxPostLength", num(e.target.value.replace(/\D/g, "")))}
                size="sm"
                classNames={inputCls}
              />
              <Input
                label="Новостей с источника"
                value={String(form.newsLimitPerSource)}
                onChange={(e) => set("newsLimitPerSource", num(e.target.value.replace(/\D/g, "")))}
                size="sm"
                classNames={inputCls}
              />
              <Input
                label="Порог анти-повтора"
                value={String(form.similarityLimit)}
                onChange={(e) => set("similarityLimit", num(e.target.value))}
                size="sm"
                classNames={inputCls}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink/40">
              Анти-повтор сравнивает новые посты с последними в истории и перегенерирует
              похожие. Картинки для постов берутся из RSS-лент, для пинов — загружаются на
              catbox.moe (бесплатно, без регистрации).
            </p>
          </div>
        </Rise>
      </div>

      <Rise className="mt-8 flex items-center gap-4">
        <Button onPress={save} isLoading={saving} className="btn-ink shimmer px-8 py-5 text-base">
          💾 Сохранить настройки
        </Button>
        {saved && <p className="text-sm font-semibold text-success">Сохранено ✓</p>}
      </Rise>
    </PageShell>
  );
}

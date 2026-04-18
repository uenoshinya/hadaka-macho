"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  toDateString,
  getMealRecord,
  saveMealRecord,
  exportAllDataForNotion,
  type MealEntry,
  type MealRecord,
} from "@/lib/storage";
import { getNotionConfig, normalizePageId } from "@/lib/notion";

type MealKey = "breakfast" | "lunch" | "dinner";

const EMPTY_MEAL = (): MealEntry => ({ content: "", calories: 0, isEatingOut: false });

const MEAL_LABELS: Record<MealKey, { label: string; emoji: string; placeholder: string }> = {
  breakfast: { label: "朝食", emoji: "🌅", placeholder: "例：納豆ごはん、味噌汁、目玉焼き" },
  lunch:     { label: "昼食", emoji: "☀️", placeholder: "例：鶏むね肉定食、サラダ、味噌汁" },
  dinner:    { label: "夕食", emoji: "🌙", placeholder: "例：サーモン刺身、玄米、豆腐サラダ" },
};

export default function MealsPage() {
  const today = toDateString();

  // 表示中の日付（デフォルトは今日）
  const [selectedDate, setSelectedDate] = useState(today);

  const [meals, setMeals] = useState<Record<MealKey, MealEntry>>({
    breakfast: EMPTY_MEAL(),
    lunch:     EMPTY_MEAL(),
    dinner:    EMPTY_MEAL(),
  });
  const [note, setNote] = useState("");
  const [savedMeals, setSavedMeals] = useState<Record<MealKey, boolean>>({ breakfast: false, lunch: false, dinner: false });
  const [noteSaved, setNoteSaved] = useState(false);
  const [savedTimes, setSavedTimes] = useState<Record<MealKey, string | null>>({ breakfast: null, lunch: null, dinner: null });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // 選択日付が変わったら既存データ読込
  useEffect(() => {
    const record = getMealRecord(selectedDate);
    if (record) {
      setNote(record.note ?? "");
      (["breakfast", "lunch", "dinner"] as MealKey[]).forEach((k) => {
        setMeals((prev) => ({ ...prev, [k]: record[k] ?? EMPTY_MEAL() }));
        setSavedTimes((prev) => ({ ...prev, [k]: record[k]?.content ? "（記録済み）" : null }));
      });
    } else {
      setNote("");
      setMeals({ breakfast: EMPTY_MEAL(), lunch: EMPTY_MEAL(), dinner: EMPTY_MEAL() });
      setSavedTimes({ breakfast: null, lunch: null, dinner: null });
    }
    setSavedMeals({ breakfast: false, lunch: false, dinner: false });
    setNoteSaved(false);
  }, [selectedDate]);

  // 日付ナビゲーション
  const isToday = selectedDate === today;
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const selDate = new Date(selectedDate + "T00:00:00+09:00");
  const dateLabel = `${selDate.getMonth() + 1}/${selDate.getDate()}（${dayNames[selDate.getDay()]}）`;

  const goToPrevDay = () => {
    const d = new Date(selectedDate + "T00:00:00+09:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateString(d));
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + "T00:00:00+09:00");
    d.setDate(d.getDate() + 1);
    const next = toDateString(d);
    if (next <= today) setSelectedDate(next);
  };

  const updateMeal = (key: MealKey, patch: Partial<MealEntry>) => {
    setMeals((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setSavedMeals((prev) => ({ ...prev, [key]: false }));
  };

  const handleSaveMeal = (key: MealKey) => {
    const existing = getMealRecord(selectedDate) ?? {
      date: selectedDate,
      breakfast: EMPTY_MEAL(), lunch: EMPTY_MEAL(), dinner: EMPTY_MEAL(), note: "",
    };
    saveMealRecord({ ...existing, [key]: meals[key] });
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setSavedMeals((prev) => ({ ...prev, [key]: true }));
    setSavedTimes((prev) => ({ ...prev, [key]: timeStr }));
    setTimeout(() => setSavedMeals((prev) => ({ ...prev, [key]: false })), 2500);
  };

  const handleSaveNote = () => {
    const existing = getMealRecord(selectedDate) ?? {
      date: selectedDate,
      breakfast: EMPTY_MEAL(), lunch: EMPTY_MEAL(), dinner: EMPTY_MEAL(), note: "",
    };
    saveMealRecord({ ...existing, note });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2500);
  };

  const handleNotionSync = async () => {
    const cfg = getNotionConfig();
    if (!cfg?.token || !cfg?.dataSyncPageId) {
      setSyncResult("⚙️ 設定ページでNotionを設定してください");
      setTimeout(() => setSyncResult(null), 3000);
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const { workouts, meals: mealData, weights } = exportAllDataForNotion();
      const res = await fetch("/api/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cfg.token,
          pageId: normalizePageId(cfg.dataSyncPageId),
          workouts, meals: mealData, weights,
        }),
      });
      const data = await res.json();
      setSyncResult(data.success ? `✅ 同期完了！(${data.updatedAt})` : `❌ ${data.error}`);
    } catch {
      setSyncResult("❌ 同期に失敗しました");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[#5C3D11]/70 hover:text-[#5C3D11] text-sm">← ホームへ</Link>
        <button
          onClick={() => setSelectedDate(today)}
          className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
            isToday ? "text-[#D4A017]" : "text-[#5C3D11]/60 hover:text-[#D4A017]"
          }`}
        >
          {isToday ? "📅 今日" : "今日に戻る"}
        </button>
      </div>

      {/* タイトル */}
      <div className="rounded-2xl bg-[#2C1A0E] px-6 py-5 text-center">
        <span className="text-4xl">🍽️</span>
        <h1 className="mt-2 text-xl font-bold text-[#D4A017]">食事記録</h1>
        <p className="mt-1 text-xs text-[#FFF8EC]/60">いつでも・何度でも更新OK</p>
      </div>

      {/* 日付ナビゲーション */}
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-[#D4A017]/30 px-4 py-3">
        <button
          onClick={goToPrevDay}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFF8EC] hover:bg-[#D4A017]/20 text-[#5C3D11] font-bold text-lg transition-colors"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-[#2C1A0E]">{dateLabel}</p>
          <p className="text-xs text-[#5C3D11]/50">{selectedDate}{isToday ? " (今日)" : ""}</p>
        </div>
        <button
          onClick={goToNextDay}
          disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFF8EC] hover:bg-[#D4A017]/20 text-[#5C3D11] font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>

      {/* トレーナー連携の説明 */}
      <div className="rounded-2xl bg-[#D4A017]/10 border border-[#D4A017]/30 px-4 py-3 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🤖</span>
        <div>
          <p className="text-xs font-bold text-[#5C3D11]">トレーナーが分析します</p>
          <p className="text-xs text-[#5C3D11]/70 mt-0.5 leading-relaxed">
            食事を入力して「Notionに同期」すると、Claude Codeトレーナーが食事アドバイスを「アドバイス」タブに送ります。
          </p>
        </div>
      </div>

      {/* 朝食・昼食・夕食 */}
      {(["breakfast", "lunch", "dinner"] as MealKey[]).map((key) => {
        const { label, emoji, placeholder } = MEAL_LABELS[key];
        const meal = meals[key];
        const isSaved = savedMeals[key];
        const savedTime = savedTimes[key];
        const hasContent = meal.content.trim().length > 0;

        return (
          <section key={key} className="bg-white rounded-2xl border-2 border-[#D4A017]/30 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[#FFF8EC] border-b border-[#D4A017]/20">
              <span className="font-bold text-[#2C1A0E] flex items-center gap-2">
                <span className="text-xl">{emoji}</span> {label}
                {savedTime && !isSaved && (
                  <span className="text-[10px] text-[#5C3D11]/50 font-normal ml-1">（{savedTime}保存済）</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    onClick={() => updateMeal(key, { isEatingOut: !meal.isEatingOut })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${meal.isEatingOut ? "bg-[#D4A017]" : "bg-[#5C3D11]/20"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${meal.isEatingOut ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className={`text-xs font-semibold ${meal.isEatingOut ? "text-[#D4A017]" : "text-[#5C3D11]/60"}`}>
                    {meal.isEatingOut ? "外食" : "自炊"}
                  </span>
                </label>
                <button
                  onClick={() => handleSaveMeal(key)}
                  disabled={!hasContent}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${
                    isSaved
                      ? "bg-[#5C3D11]/20 text-[#5C3D11]"
                      : !hasContent
                      ? "bg-[#5C3D11]/10 text-[#5C3D11]/30 cursor-not-allowed"
                      : "bg-[#D4A017] hover:bg-[#c4920f] text-[#2C1A0E] shadow-sm"
                  }`}
                >
                  {isSaved ? "✅ 保存" : "保存"}
                </button>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <textarea
                value={meal.content}
                onChange={(e) => updateMeal(key, { content: e.target.value })}
                placeholder={placeholder}
                rows={2}
                className="w-full rounded-xl border-2 border-[#D4A017]/20 focus:border-[#D4A017] bg-[#FFF8EC] px-3 py-2.5 text-sm text-[#2C1A0E] outline-none resize-none transition-colors leading-relaxed"
              />
              {hasContent && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D4A017]" />
                  <span className="text-xs text-[#D4A017] font-semibold">
                    {isSaved ? "保存しました！" : "未保存 — 「保存」ボタンで記録"}
                  </span>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* 全体メモ */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-[#5C3D11]">📝 メモ（任意）</label>
          <button
            onClick={handleSaveNote}
            disabled={!note.trim()}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${
              noteSaved
                ? "bg-[#5C3D11]/20 text-[#5C3D11]"
                : !note.trim()
                ? "bg-[#5C3D11]/10 text-[#5C3D11]/30 cursor-not-allowed"
                : "bg-[#D4A017] hover:bg-[#c4920f] text-[#2C1A0E]"
            }`}
          >
            {noteSaved ? "✅ 保存" : "保存"}
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }}
          placeholder="食欲の状態、外食の店名、体調など..."
          rows={2}
          className="w-full rounded-xl border-2 border-[#D4A017]/30 focus:border-[#D4A017] bg-white px-4 py-3 text-sm text-[#2C1A0E] outline-none resize-none transition-colors"
        />
      </section>

      {/* Notion同期ボタン */}
      <button
        onClick={handleNotionSync}
        disabled={syncing}
        className="w-full py-3 rounded-2xl font-bold text-sm border-2 border-[#5C3D11]/30 text-[#5C3D11] hover:border-[#5C3D11] hover:bg-[#5C3D11]/5 transition-all disabled:opacity-50"
      >
        {syncing ? "⏳ Notionに同期中..." : "☁️ Notionにデータを同期する"}
      </button>
      {syncResult && (
        <p className="text-center text-xs text-[#5C3D11]/80 -mt-2">{syncResult}</p>
      )}
    </div>
  );
}

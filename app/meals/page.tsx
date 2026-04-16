"use client";

import { useEffect, useRef, useState } from "react";
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

// ===== 型 =====
type MealKey = "breakfast" | "lunch" | "dinner";

interface MealState extends MealEntry {
  photoPreview: string | null; // base64 プレビュー（localStorageには保存しない）
  photoBase64: string | null;  // API送信用
  isEstimating: boolean;
}

const EMPTY_MEAL = (): MealState => ({
  content: "",
  calories: 0,
  isEatingOut: false,
  photoPreview: null,
  photoBase64: null,
  isEstimating: false,
});

const MEAL_LABELS: Record<MealKey, { label: string; emoji: string }> = {
  breakfast: { label: "朝食", emoji: "🌅" },
  lunch:     { label: "昼食", emoji: "☀️" },
  dinner:    { label: "夕食", emoji: "🌙" },
};

// ===== Gemini API でカロリー推定（無料枠：1日1,500回）=====
async function estimateCaloriesWithGemini(
  apiKey: string,
  content: string,
  photoBase64: string | null,
  mimeType: string
): Promise<{ description: string; calories: number }> {
  const textPrompt =
    "この食事の内容を見て、各料理のカロリーと合計カロリーを日本語で推定してください。\n" +
    "形式：\n料理名1 約〇〇kcal\n料理名2 約〇〇kcal\n合計：〇〇kcal\n\n" +
    "最後の行は必ず「合計：〇〇kcal」という形式にしてください。" +
    (content ? `\n\n食事メモ：${content}` : "");

  const parts: unknown[] = [];
  if (photoBase64) {
    parts.push({ inline_data: { mime_type: mimeType, data: photoBase64 } });
  }
  parts.push({ text: textPrompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? "API Error";
    throw new Error(msg);
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const match = text.match(/合計[：:]\s*(\d+)\s*kcal/i);
  const calories = match ? parseInt(match[1], 10) : 0;

  return { description: text, calories };
}

// ===== コンポーネント =====
export default function MealsPage() {
  const today = toDateString();

  const [meals, setMeals] = useState<Record<MealKey, MealState>>({
    breakfast: EMPTY_MEAL(),
    lunch:     EMPTY_MEAL(),
    dinner:    EMPTY_MEAL(),
  });
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiResult, setAiResult] = useState<Record<MealKey, string>>({ breakfast: "", lunch: "", dinner: "" });

  const mimeRefs = useRef<Record<MealKey, string>>({ breakfast: "image/jpeg", lunch: "image/jpeg", dinner: "image/jpeg" });
  const fileInputRefs = useRef<Record<MealKey, HTMLInputElement | null>>({ breakfast: null, lunch: null, dinner: null });

  // 既存データ読込
  useEffect(() => {
    const savedKey = localStorage.getItem("hadaka_claude_api_key") ?? "";
    setApiKey(savedKey);

    const record = getMealRecord(today);
    if (record) {
      setNote(record.note);
      (["breakfast", "lunch", "dinner"] as MealKey[]).forEach((k) => {
        const entry = record[k];
        if (entry) {
          setMeals((prev) => ({
            ...prev,
            [k]: { ...EMPTY_MEAL(), content: entry.content, calories: entry.calories, isEatingOut: entry.isEatingOut },
          }));
        }
      });
    }
  }, [today]);

  const updateMeal = (key: MealKey, patch: Partial<MealState>) => {
    setMeals((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setSaved(false);
  };

  // 写真選択
  const handlePhoto = (key: MealKey, file: File) => {
    const mime = file.type || "image/jpeg";
    mimeRefs.current[key] = mime;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // base64部分だけ抽出（"data:image/jpeg;base64," を除く）
      const base64 = dataUrl.split(",")[1];
      updateMeal(key, { photoPreview: dataUrl, photoBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

  // AI カロリー推定
  const handleEstimate = async (key: MealKey) => {
    if (!apiKey) {
      setShowApiKey(true);
      return;
    }
    const meal = meals[key];
    if (!meal.photoBase64 && !meal.content) return;

    updateMeal(key, { isEstimating: true });
    try {
      const result = await estimateCaloriesWithGemini(
        apiKey,
        meal.content,
        meal.photoBase64,
        mimeRefs.current[key]
      );
      setAiResult((prev) => ({ ...prev, [key]: result.description }));
      updateMeal(key, { calories: result.calories, isEstimating: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiResult((prev) => ({ ...prev, [key]: `❌ エラー: ${msg}` }));
      updateMeal(key, { isEstimating: false });
    }
  };

  // Notion同期
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
      const { workouts, meals, weights } = exportAllDataForNotion();
      const res = await fetch("/api/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cfg.token,
          pageId: normalizePageId(cfg.dataSyncPageId),
          workouts, meals, weights,
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

  // 保存
  const handleSave = () => {
    const toEntry = (m: MealState): MealEntry => ({
      content: m.content,
      calories: m.calories,
      isEatingOut: m.isEatingOut,
    });
    const record: MealRecord = {
      date: today,
      breakfast: toEntry(meals.breakfast),
      lunch:     toEntry(meals.lunch),
      dinner:    toEntry(meals.dinner),
      note,
    };
    saveMealRecord(record);
    if (apiKey) localStorage.setItem("hadaka_claude_api_key", apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalCalories =
    (meals.breakfast.calories || 0) +
    (meals.lunch.calories || 0) +
    (meals.dinner.calories || 0);

  const calColor =
    totalCalories === 0 ? "text-[#5C3D11]/50" :
    totalCalories < 1600 ? "text-green-600" :
    totalCalories < 2300 ? "text-[#D4A017]" :
    "text-red-500";

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[#5C3D11]/70 hover:text-[#5C3D11] text-sm">← ホームへ</Link>
        <span className="text-xs text-[#5C3D11]/50">{today}</span>
      </div>

      {/* タイトル */}
      <div className="rounded-2xl bg-[#2C1A0E] px-6 py-5 text-center">
        <span className="text-4xl">🍽️</span>
        <h1 className="mt-2 text-xl font-bold text-[#D4A017]">今日の食事記録</h1>

        {/* 合計カロリー */}
        <div className="mt-3 flex justify-center items-baseline gap-2">
          <span className={`text-3xl font-bold ${totalCalories > 0 ? "text-white" : "text-white/30"}`}>
            {totalCalories > 0 ? totalCalories.toLocaleString() : "—"}
          </span>
          <span className="text-white/50 text-sm">kcal / 日</span>
        </div>
        {totalCalories > 0 && (
          <p className={`text-xs mt-1 font-semibold ${calColor}`}>
            {totalCalories < 1600 ? "✅ 低め（ダイエット向き）" :
             totalCalories < 2300 ? "👍 理想的な範囲" :
             "⚠️ やや多め"}
          </p>
        )}
      </div>

      {/* Claude API キー設定 */}
      {(showApiKey || !apiKey) && (
        <div className="rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/40 px-4 py-3">
          <p className="text-xs font-bold text-[#5C3D11] mb-0.5">🤖 AI カロリー推定 — Google Gemini APIキー</p>
          <p className="text-[10px] text-[#5C3D11]/60 mb-1.5">
            無料で取得 →{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
               className="underline text-[#D4A017]">aistudio.google.com/apikey</a>
            （Googleアカウントのみ）
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="flex-1 rounded-lg border border-[#D4A017]/40 bg-white px-3 py-1.5 text-xs outline-none"
            />
            <button
              onClick={() => { localStorage.setItem("hadaka_claude_api_key", apiKey); setShowApiKey(false); }}
              className="px-3 py-1.5 bg-[#D4A017] text-[#2C1A0E] text-xs font-bold rounded-lg"
            >
              保存
            </button>
          </div>
          <p className="text-[10px] text-[#5C3D11]/60 mt-1">このデバイスのみに保存 ／ 無料枠：1日1,500回まで</p>
        </div>
      )}
      {apiKey && !showApiKey && (
        <button onClick={() => setShowApiKey(true)} className="text-xs text-[#5C3D11]/50 text-right hover:underline">
          🔑 APIキー変更
        </button>
      )}

      {/* 朝食・昼食・夕食 セクション */}
      {(["breakfast", "lunch", "dinner"] as MealKey[]).map((key) => {
        const { label, emoji } = MEAL_LABELS[key];
        const meal = meals[key];
        const result = aiResult[key];

        return (
          <section key={key} className="bg-white rounded-2xl border-2 border-[#D4A017]/30 overflow-hidden">
            {/* セクションヘッダー */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#FFF8EC] border-b border-[#D4A017]/20">
              <span className="font-bold text-[#2C1A0E] flex items-center gap-2">
                <span className="text-xl">{emoji}</span> {label}
              </span>
              <div className="flex items-center gap-3">
                {/* 自炊/外食 トグル */}
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

                {/* カロリー */}
                <span className={`text-sm font-bold ${meal.calories > 0 ? "text-[#D4A017]" : "text-[#5C3D11]/30"}`}>
                  {meal.calories > 0 ? `${meal.calories} kcal` : "— kcal"}
                </span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* 写真アップロード */}
              <div>
                {meal.photoPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={meal.photoPreview}
                      alt={`${label}の写真`}
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => updateMeal(key, { photoPreview: null, photoBase64: null })}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRefs.current[key]?.click()}
                    className="w-full h-24 rounded-xl border-2 border-dashed border-[#D4A017]/40 hover:border-[#D4A017] bg-[#FFF8EC] flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <span className="text-2xl">📷</span>
                    <span className="text-xs text-[#5C3D11]/70">写真を選ぶ / カメラで撮影</span>
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={(el) => { fileInputRefs.current[key] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhoto(key, file);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* メモ入力 */}
              <input
                type="text"
                value={meal.content}
                onChange={(e) => updateMeal(key, { content: e.target.value })}
                placeholder={`${label}のメモ（例：鶏むね肉、サラダ、玄米）`}
                className="w-full rounded-xl border-2 border-[#D4A017]/20 focus:border-[#D4A017] bg-[#FFF8EC] px-3 py-2 text-sm text-[#2C1A0E] outline-none transition-colors"
              />

              {/* カロリー & AI推定 */}
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    value={meal.calories || ""}
                    onChange={(e) => updateMeal(key, { calories: Number(e.target.value) || 0 })}
                    placeholder="kcal"
                    className="w-full rounded-xl border-2 border-[#D4A017]/20 focus:border-[#D4A017] bg-[#FFF8EC] px-3 py-2 text-sm text-[#2C1A0E] outline-none transition-colors text-center"
                  />
                </div>
                <button
                  onClick={() => handleEstimate(key)}
                  disabled={meal.isEstimating || (!meal.photoBase64 && !meal.content)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    meal.isEstimating
                      ? "bg-[#5C3D11]/20 text-[#5C3D11] animate-pulse"
                      : (!meal.photoBase64 && !meal.content)
                      ? "bg-[#5C3D11]/10 text-[#5C3D11]/40 cursor-not-allowed"
                      : "bg-[#2C1A0E] text-[#D4A017] hover:bg-[#3d2410]"
                  }`}
                >
                  {meal.isEstimating ? "推定中..." : "🤖 AI推定"}
                </button>
              </div>

              {/* AI推定結果 */}
              {result && (
                <div className="rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/30 px-3 py-2">
                  <p className="text-[10px] font-bold text-[#D4A017] mb-1">🤖 AI推定結果</p>
                  <p className="text-xs text-[#5C3D11] whitespace-pre-line leading-relaxed">{result}</p>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* 全体メモ */}
      <section>
        <label className="block text-sm font-semibold text-[#5C3D11] mb-2">📝 今日の食事メモ</label>
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          placeholder="食欲の状態、気づき、反省点など..."
          rows={2}
          className="w-full rounded-xl border-2 border-[#D4A017]/30 focus:border-[#D4A017] bg-white px-4 py-3 text-sm text-[#2C1A0E] outline-none resize-none transition-colors"
        />
      </section>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        className={`w-full py-4 rounded-2xl font-bold text-base tracking-wider transition-all duration-300 ${
          saved
            ? "bg-[#5C3D11]/20 text-[#5C3D11]"
            : "bg-[#D4A017] hover:bg-[#c4920f] text-[#2C1A0E] shadow-[0_4px_20px_rgba(212,160,23,0.4)]"
        }`}
      >
        {saved ? "✅ 保存しました！" : "🍽️ 食事を記録する"}
      </button>

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

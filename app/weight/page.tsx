"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  toDateString,
  getWeekDates,
  getWeightRecords,
  saveWeightRecord,
  exportAllDataForNotion,
  type WeightRecord,
} from "@/lib/storage";
import { getNotionConfig, normalizePageId } from "@/lib/notion";

export default function WeightPage() {
  const today = toDateString();

  // 表示中の日付（デフォルトは今日）
  const [selectedDate, setSelectedDate] = useState(today);

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedTime, setSavedTime] = useState<string | null>(null);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const weekDates = getWeekDates();

  const loadRecords = () => setRecords(getWeightRecords());

  // 選択日付が変わったら入力欄をリセット・既存データ読込
  useEffect(() => {
    loadRecords();
    const existing = getWeightRecords().find((r) => r.date === selectedDate);
    if (existing) {
      setWeight(String(existing.weight));
      setBodyFat(existing.bodyFat !== null ? String(existing.bodyFat) : "");
      setSavedTime("（記録済み）");
    } else {
      setWeight("");
      setBodyFat("");
      setSavedTime(null);
    }
    setSaved(false);
  }, [selectedDate]);

  // 日付ナビゲーション
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

  const isToday = selectedDate === today;

  // 日付ラベル
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const selDate = new Date(selectedDate + "T00:00:00+09:00");
  const dateLabel = `${selDate.getMonth() + 1}/${selDate.getDate()}（${dayNames[selDate.getDay()]}）`;

  const handleSave = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return;
    const record: WeightRecord = {
      date: selectedDate,
      weight: w,
      bodyFat: bodyFat ? parseFloat(bodyFat) : null,
    };
    saveWeightRecord(record);
    loadRecords();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setSavedTime(`${timeStr} 更新`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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

  // 直近レコード（7件）
  const recentRecords = weekDates.map((d) => records.find((r) => r.date === d) ?? null);
  const allWeights = records.map((r) => r.weight).filter(Boolean);
  const minW = allWeights.length ? Math.min(...allWeights) : 0;
  const maxW = allWeights.length ? Math.max(...allWeights) : 1;

  // 体重変化
  const latest = records[records.length - 1];
  const prev = records[records.length - 2];
  const diff = latest && prev ? (latest.weight - prev.weight).toFixed(1) : null;

  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="flex flex-col gap-6">
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
        <span className="text-4xl">⚖️</span>
        <h1 className="mt-2 text-xl font-bold text-[#D4A017]">体重・体脂肪率の記録</h1>
        {latest && (
          <div className="mt-2 flex justify-center items-baseline gap-3">
            <span className="text-3xl font-bold text-white">{latest.weight}<span className="text-base font-normal text-white/60"> kg</span></span>
            {diff && (
              <span className={`text-sm font-bold ${Number(diff) < 0 ? "text-green-400" : Number(diff) > 0 ? "text-red-400" : "text-white/60"}`}>
                {Number(diff) > 0 ? `+${diff}` : diff} kg
              </span>
            )}
          </div>
        )}
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
          <p className="text-xs text-[#5C3D11]/50">{selectedDate}</p>
        </div>
        <button
          onClick={goToNextDay}
          disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFF8EC] hover:bg-[#D4A017]/20 text-[#5C3D11] font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>

      {/* 入力フォーム */}
      <section className="bg-white rounded-2xl border-2 border-[#D4A017]/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#5C3D11]">
            {isToday ? "📅 今日の記録" : `📅 ${dateLabel}の記録`}
          </h2>
          {savedTime && (
            <span className="text-xs text-[#5C3D11]/50">{savedTime}</span>
          )}
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#5C3D11] mb-1.5">体重 (kg) <span className="text-red-400">*</span></label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => { setWeight(e.target.value); setSaved(false); }}
              placeholder="例：72.5"
              className="w-full rounded-xl border-2 border-[#D4A017]/30 focus:border-[#D4A017] bg-[#FFF8EC] px-3 py-2.5 text-sm text-[#2C1A0E] outline-none transition-colors text-center font-bold"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#5C3D11] mb-1.5">体脂肪率 (%) <span className="text-[#5C3D11]/40">任意</span></label>
            <input
              type="number"
              step="0.1"
              value={bodyFat}
              onChange={(e) => { setBodyFat(e.target.value); setSaved(false); }}
              placeholder="例：18.2"
              className="w-full rounded-xl border-2 border-[#D4A017]/30 focus:border-[#D4A017] bg-[#FFF8EC] px-3 py-2.5 text-sm text-[#2C1A0E] outline-none transition-colors text-center font-bold"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!weight}
          className={`w-full py-3 rounded-xl font-bold text-sm tracking-wider transition-all duration-300 ${
            !weight
              ? "bg-[#5C3D11]/20 text-[#5C3D11]/40 cursor-not-allowed"
              : saved
              ? "bg-[#5C3D11]/20 text-[#5C3D11]"
              : "bg-[#D4A017] hover:bg-[#c4920f] text-[#2C1A0E] shadow-[0_4px_16px_rgba(212,160,23,0.35)]"
          }`}
        >
          {saved ? "✅ 更新しました！" : savedTime && savedTime !== "（記録済み）" ? "⚖️ 再記録する（上書き）" : savedTime === "（記録済み）" ? "⚖️ 上書き保存" : "⚖️ 記録する"}
        </button>
      </section>

      {/* 今週のグラフ */}
      <section className="bg-white rounded-2xl border-2 border-[#D4A017]/30 p-5">
        <h2 className="text-sm font-bold text-[#5C3D11] mb-4">📈 今週の体重推移</h2>

        {allWeights.length > 0 ? (
          <>
            <div className="flex items-end justify-between gap-2 h-28 mb-2">
              {weekDates.map((date, i) => {
                const rec = recentRecords[i];
                const d = new Date(date + "T00:00:00+09:00");
                const dayLabel = dayLabels[d.getDay()];
                const isSelected = date === selectedDate;

                const barHeight = rec
                  ? maxW === minW
                    ? 80
                    : Math.max(20, ((rec.weight - minW) / (maxW - minW)) * 70 + 20)
                  : 0;

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    {rec && (
                      <span className="text-[10px] font-bold text-[#D4A017]">{rec.weight}</span>
                    )}
                    <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                      {rec ? (
                        <div
                          className={`w-full rounded-t-lg transition-all ${isSelected ? "bg-[#D4A017]" : "bg-[#D4A017]/40 group-hover:bg-[#D4A017]/60"}`}
                          style={{ height: `${barHeight}px` }}
                        />
                      ) : (
                        <div className="w-full h-2 rounded-t-lg bg-[#5C3D11]/10 group-hover:bg-[#D4A017]/20 transition-colors" />
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold ${isSelected ? "text-[#D4A017]" : "text-[#5C3D11]/60"}`}>
                      {dayLabel}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-[#5C3D11]/60 mt-2">
              <span>最小: <strong>{minW} kg</strong></span>
              <span>最大: <strong>{maxW} kg</strong></span>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-[#5C3D11]/50 text-sm">
            <p>まだデータがありません。</p>
            <p className="text-xs mt-1">毎日記録してグラフを育てよう！</p>
          </div>
        )}
      </section>

      {/* 直近記録一覧 */}
      {records.length > 0 && (
        <section className="bg-white rounded-2xl border-2 border-[#D4A017]/30 p-5">
          <h2 className="text-sm font-bold text-[#5C3D11] mb-3">🗓️ 記録履歴</h2>
          <div className="flex flex-col gap-2">
            {[...records].reverse().slice(0, 10).map((r) => (
              <button
                key={r.date}
                onClick={() => setSelectedDate(r.date)}
                className={`flex items-center justify-between py-2 px-3 rounded-xl text-left transition-colors ${
                  r.date === selectedDate ? "bg-[#D4A017]/20 border border-[#D4A017]/40" : "bg-[#FFF8EC] hover:bg-[#D4A017]/10"
                }`}
              >
                <span className={`text-xs font-semibold ${r.date === selectedDate ? "text-[#D4A017]" : "text-[#5C3D11]/70"}`}>
                  {r.date} {r.date === today ? "(今日)" : ""}
                </span>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="text-[#2C1A0E]">{r.weight} kg</span>
                  {r.bodyFat !== null && (
                    <span className="text-xs text-[#5C3D11]/60">{r.bodyFat}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

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

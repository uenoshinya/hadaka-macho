"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  toDateString,
  getWeekDates,
  getWeightRecords,
  saveWeightRecord,
  type WeightRecord,
} from "@/lib/storage";

export default function WeightPage() {
  const today = toDateString();

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const weekDates = getWeekDates();

  const loadRecords = () => {
    setRecords(getWeightRecords());
  };

  useEffect(() => {
    loadRecords();
    const existing = getWeightRecords().find((r) => r.date === today);
    if (existing) {
      setWeight(String(existing.weight));
      setBodyFat(existing.bodyFat !== null ? String(existing.bodyFat) : "");
    }
  }, [today]);

  const handleSave = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return;
    const record: WeightRecord = {
      date: today,
      weight: w,
      bodyFat: bodyFat ? parseFloat(bodyFat) : null,
    };
    saveWeightRecord(record);
    loadRecords();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <span className="text-xs text-[#5C3D11]/50">{today}</span>
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

      {/* 今日の入力 */}
      <section className="bg-white rounded-2xl border-2 border-[#D4A017]/30 p-5">
        <h2 className="text-sm font-bold text-[#5C3D11] mb-4">📅 今日の記録（{today}）</h2>

        <div className="flex gap-4 mb-4">
          {/* 体重 */}
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

          {/* 体脂肪率 */}
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
          {saved ? "✅ 保存しました！" : "⚖️ 記録する"}
        </button>
      </section>

      {/* 今週のグラフ */}
      <section className="bg-white rounded-2xl border-2 border-[#D4A017]/30 p-5">
        <h2 className="text-sm font-bold text-[#5C3D11] mb-4">📈 今週の体重推移</h2>

        {allWeights.length > 0 ? (
          <>
            {/* バーグラフ */}
            <div className="flex items-end justify-between gap-2 h-28 mb-2">
              {weekDates.map((date, i) => {
                const rec = recentRecords[i];
                const d = new Date(date);
                const dayLabel = dayLabels[d.getDay()];
                const isToday = date === today;

                const barHeight = rec
                  ? maxW === minW
                    ? 80
                    : Math.max(20, ((rec.weight - minW) / (maxW - minW)) * 70 + 20)
                  : 0;

                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1">
                    {rec && (
                      <span className="text-[10px] font-bold text-[#D4A017]">{rec.weight}</span>
                    )}
                    <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                      {rec ? (
                        <div
                          className={`w-full rounded-t-lg transition-all ${isToday ? "bg-[#D4A017]" : "bg-[#D4A017]/40"}`}
                          style={{ height: `${barHeight}px` }}
                        />
                      ) : (
                        <div className="w-full h-2 rounded-t-lg bg-[#5C3D11]/10" />
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold ${isToday ? "text-[#D4A017]" : "text-[#5C3D11]/60"}`}>
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 最小・最大 */}
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
              <div key={r.date} className={`flex items-center justify-between py-2 px-3 rounded-xl ${r.date === today ? "bg-[#D4A017]/10" : "bg-[#FFF8EC]"}`}>
                <span className={`text-xs font-semibold ${r.date === today ? "text-[#D4A017]" : "text-[#5C3D11]/70"}`}>
                  {r.date} {r.date === today ? "(今日)" : ""}
                </span>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="text-[#2C1A0E]">{r.weight} kg</span>
                  {r.bodyFat !== null && (
                    <span className="text-xs text-[#5C3D11]/60">{r.bodyFat}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

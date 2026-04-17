"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTodayWorkout } from "@/data/workout";
import {
  toDateString,
  getWorkoutRecord,
  getMealRecord,
  getLatestWeight,
  type WeightRecord,
} from "@/lib/storage";
import { getNotionConfig, normalizePageId } from "@/lib/notion";

export default function Home() {
  const today = toDateString();
  const todayWorkout = getTodayWorkout();

  const [workoutDone, setWorkoutDone] = useState(false);
  const [mealDone, setMealDone] = useState(false);
  const [latestWeight, setLatestWeight] = useState<WeightRecord | null>(null);
  const [advicePreview, setAdvicePreview] = useState<string | null>(null);
  const [notionConfigured, setNotionConfigured] = useState(false);

  useEffect(() => {
    const wr = getWorkoutRecord(today);
    setWorkoutDone(wr?.completed ?? false);
    const mr = getMealRecord(today);
    setMealDone(!!(mr?.breakfast?.content || mr?.lunch?.content || mr?.dinner?.content));
    setLatestWeight(getLatestWeight());

    // アドバイスプレビューを取得
    const cfg = getNotionConfig();
    if (cfg?.token && cfg?.advicePageId) {
      setNotionConfigured(true);
      fetch(`/api/notion/advice?token=${encodeURIComponent(cfg.token)}&pageId=${encodeURIComponent(normalizePageId(cfg.advicePageId))}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.content) {
            // 最初の2〜3行だけ表示
            const lines = data.content.split("\n").filter((l: string) => l.trim()).slice(0, 3);
            setAdvicePreview(lines.join(" / "));
          }
        })
        .catch(() => {});
    }
  }, [today]);

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  // JST（UTC+9）で日付・曜日を計算
  const nowJst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const dateLabel = `${nowJst.getUTCMonth() + 1}/${nowJst.getUTCDate()}（${dayNames[nowJst.getUTCDay()]}）`;

  return (
    <div className="flex flex-col gap-6">
      {/* ヒーローカード */}
      <div className="relative rounded-3xl bg-[#2C1A0E] overflow-hidden px-6 py-8 text-center shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4A017]/20 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <span className="text-5xl">🦁</span>
          <h1 className="mt-3 text-2xl font-bold text-[#D4A017] tracking-wider">裸マッチョへの道</h1>
          <p className="mt-1 text-sm text-[#FFF8EC]/70">{dateLabel} — 今日もやりきろう！</p>

          {/* 今日のステータスバッジ */}
          <div className="mt-5 flex justify-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${workoutDone ? "bg-[#D4A017] text-[#2C1A0E]" : "bg-white/10 text-white/60"}`}>
              {workoutDone ? "✅ 筋トレ完了" : "⬜ 筋トレ未完"}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${mealDone ? "bg-[#D4A017] text-[#2C1A0E]" : "bg-white/10 text-white/60"}`}>
              {mealDone ? "✅ 食事記録済" : "⬜ 食事未記録"}
            </span>
          </div>
        </div>
      </div>

      {/* 今日のトレーニング */}
      <section>
        <h2 className="text-base font-bold text-[#5C3D11] mb-3 flex items-center gap-2">
          <span>{todayWorkout.emoji}</span> 今日のトレーニング
        </h2>
        <Link
          href="/workout"
          className="block rounded-2xl bg-white border-2 border-[#D4A017]/30 hover:border-[#D4A017] p-5 transition-all hover:shadow-[0_4px_20px_rgba(212,160,23,0.2)] group"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-lg font-bold text-[#2C1A0E]">{todayWorkout.part}</p>
              <p className="text-sm text-[#5C3D11]/70">{todayWorkout.dayName}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#D4A017]">{todayWorkout.exercises.length}</p>
              <p className="text-xs text-[#5C3D11]/60">種目</p>
            </div>
          </div>

          {/* エクササイズプレビュー */}
          <ul className="flex flex-col gap-1.5 mb-4">
            {todayWorkout.exercises.slice(0, 3).map((ex, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-[#2C1A0E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] flex-shrink-0" />
                {ex.name}
                <span className="text-xs text-[#5C3D11]/60 ml-auto">{ex.sets}セット × {ex.reps}</span>
              </li>
            ))}
            {todayWorkout.exercises.length > 3 && (
              <li className="text-xs text-[#5C3D11]/60 pl-3.5">+ {todayWorkout.exercises.length - 3}種目</li>
            )}
          </ul>

          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${workoutDone ? "bg-[#D4A017]/20 text-[#D4A017]" : "bg-[#5C3D11]/10 text-[#5C3D11]"}`}>
              {workoutDone ? "✅ 完了済み" : "タップして記録する →"}
            </span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
              className="text-[#D4A017]/40 group-hover:text-[#D4A017] group-hover:translate-x-1 transition-all">
              <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>
      </section>

      {/* 食事 & 体重 カード */}
      <section className="grid grid-cols-2 gap-4">
        {/* 食事記録 */}
        <Link
          href="/meals"
          className="rounded-2xl bg-white border-2 border-[#D4A017]/30 hover:border-[#D4A017] p-5 transition-all hover:shadow-[0_4px_20px_rgba(212,160,23,0.2)] group"
        >
          <span className="text-3xl block mb-2">🍽️</span>
          <p className="text-sm font-bold text-[#2C1A0E]">食事記録</p>
          <p className={`text-xs mt-1 ${mealDone ? "text-[#D4A017] font-semibold" : "text-[#5C3D11]/60"}`}>
            {mealDone ? "✅ 記録済み" : "未記録"}
          </p>
        </Link>

        {/* 体重記録 */}
        <Link
          href="/weight"
          className="rounded-2xl bg-white border-2 border-[#D4A017]/30 hover:border-[#D4A017] p-5 transition-all hover:shadow-[0_4px_20px_rgba(212,160,23,0.2)] group"
        >
          <span className="text-3xl block mb-2">⚖️</span>
          <p className="text-sm font-bold text-[#2C1A0E]">体重記録</p>
          {latestWeight ? (
            <p className="text-xs mt-1 text-[#D4A017] font-semibold">{latestWeight.weight} kg</p>
          ) : (
            <p className="text-xs mt-1 text-[#5C3D11]/60">未記録</p>
          )}
        </Link>
      </section>

      {/* トレーナーからのアドバイスプレビュー */}
      <section>
        <Link href="/advice" className="block rounded-2xl border-2 border-[#D4A017]/40 bg-white hover:border-[#D4A017] p-4 transition-all group">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#5C3D11] mb-1">トレーナーからのアドバイス</p>
              {notionConfigured ? (
                advicePreview ? (
                  <p className="text-xs text-[#2C1A0E]/70 truncate">{advicePreview}</p>
                ) : (
                  <p className="text-xs text-[#5C3D11]/50">読み込み中...</p>
                )
              ) : (
                <p className="text-xs text-[#5C3D11]/50">⚙️ Notion連携を設定してください</p>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
              className="text-[#D4A017]/40 group-hover:text-[#D4A017] flex-shrink-0 transition-colors">
              <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>
      </section>

      {/* 今週の合言葉 */}
      <section className="rounded-2xl bg-[#5C3D11]/10 border border-[#D4A017]/20 px-5 py-4 text-center">
        <p className="text-[#5C3D11] text-sm font-semibold">
          💪 &ldquo;継続は力なり。今日の積み重ねが裸マッチョへの道だ。&rdquo;
        </p>
      </section>
    </div>
  );
}

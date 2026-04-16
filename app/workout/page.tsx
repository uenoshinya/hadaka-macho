"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTodayWorkout, type Exercise } from "@/data/workout";
import {
  toDateString,
  getWorkoutRecord,
  saveWorkoutRecord,
  exportAllDataForNotion,
  type WorkoutRecord,
} from "@/lib/storage";
import { getNotionConfig, normalizePageId } from "@/lib/notion";

export default function WorkoutPage() {
  const today = toDateString();
  const todayWorkout = getTodayWorkout();

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    const record = getWorkoutRecord(today);
    if (record) {
      const init: Record<string, boolean> = {};
      todayWorkout.exercises.forEach((ex) => {
        init[ex.name] = record.completedExercises.includes(ex.name);
      });
      setChecked(init);
      setNote(record.note);
      setAlreadyDone(record.completed);
    } else {
      const init: Record<string, boolean> = {};
      todayWorkout.exercises.forEach((ex) => { init[ex.name] = false; });
      setChecked(init);
    }
  }, [today, todayWorkout.exercises]);

  const toggle = (name: string) => {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
    setSaved(false);
  };

  const completedCount = Object.values(checked).filter(Boolean).length;
  const total = todayWorkout.exercises.length;
  const allDone = completedCount === total;

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
          workouts,
          meals,
          weights,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`✅ 同期完了！(${data.updatedAt})`);
      } else {
        setSyncResult(`❌ ${data.error}`);
      }
    } catch {
      setSyncResult("❌ 同期に失敗しました");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  };

  const handleSave = () => {
    const record: WorkoutRecord = {
      date: today,
      completed: allDone,
      completedExercises: Object.entries(checked)
        .filter(([, v]) => v)
        .map(([k]) => k),
      note,
    };
    saveWorkoutRecord(record);
    setSaved(true);
    setAlreadyDone(allDone);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[#5C3D11]/70 hover:text-[#5C3D11] text-sm">← ホームへ</Link>
        <span className="text-xs text-[#5C3D11]/50">{today}</span>
      </div>

      {/* タイトルカード */}
      <div className="rounded-2xl bg-[#2C1A0E] px-6 py-5 text-center">
        <span className="text-4xl">{todayWorkout.emoji}</span>
        <h1 className="mt-2 text-xl font-bold text-[#D4A017]">
          {todayWorkout.dayName} — {todayWorkout.part}
        </h1>
        {alreadyDone && (
          <span className="inline-block mt-2 px-3 py-1 bg-[#D4A017] text-[#2C1A0E] text-xs font-bold rounded-full">
            ✅ 本日完了済み！
          </span>
        )}
      </div>

      {/* 進捗バー */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-[#5C3D11]">進捗</span>
          <span className="font-bold text-[#D4A017]">{completedCount} / {total} 種目</span>
        </div>
        <div className="w-full h-3 bg-[#5C3D11]/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D4A017] to-[#F5C842] rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }}
          />
        </div>
        {allDone && (
          <p className="mt-2 text-center text-sm font-bold text-[#D4A017]">🎉 全種目クリア！お疲れ様！</p>
        )}
      </div>

      {/* エクササイズリスト */}
      <section className="flex flex-col gap-3">
        {todayWorkout.exercises.map((ex: Exercise) => (
          <div
            key={ex.name}
            onClick={() => toggle(ex.name)}
            className={`cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 ${
              checked[ex.name]
                ? "border-[#D4A017] bg-[#D4A017]/10 shadow-[0_2px_12px_rgba(212,160,23,0.2)]"
                : "border-[#D4A017]/20 bg-white hover:border-[#D4A017]/50"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* チェックボックス */}
              <div className={`mt-0.5 w-6 h-6 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                checked[ex.name] ? "border-[#D4A017] bg-[#D4A017]" : "border-[#D4A017]/40"
              }`}>
                {checked[ex.name] && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#2C1A0E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`font-bold text-sm ${checked[ex.name] ? "text-[#D4A017]" : "text-[#2C1A0E]"}`}>
                    {ex.name}
                  </p>
                  <span className="text-xs text-[#5C3D11]/70 font-semibold bg-[#5C3D11]/10 px-2 py-0.5 rounded-full">
                    {ex.sets}セット × {ex.reps}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5C3D11]/70 leading-relaxed">{ex.description}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* メモ */}
      <section>
        <label className="block text-sm font-semibold text-[#5C3D11] mb-2">📝 今日のメモ</label>
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          placeholder="気づき・感想・次回の目標など..."
          rows={3}
          className="w-full rounded-xl border-2 border-[#D4A017]/30 focus:border-[#D4A017] bg-white px-4 py-3 text-sm text-[#2C1A0E] outline-none resize-none transition-colors"
        />
      </section>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        className={`w-full py-4 rounded-2xl font-bold text-base tracking-wider transition-all duration-300 ${
          saved
            ? "bg-[#5C3D11]/20 text-[#5C3D11]"
            : "bg-[#D4A017] hover:bg-[#c4920f] text-[#2C1A0E] shadow-[0_4px_20px_rgba(212,160,23,0.4)] hover:shadow-[0_6px_28px_rgba(212,160,23,0.5)]"
        }`}
      >
        {saved ? "✅ 保存しました！" : "💪 記録を保存する"}
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

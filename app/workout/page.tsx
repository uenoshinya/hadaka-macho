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

  // 種目名 → セットごとの達成フラグ
  const [sets, setSets] = useState<Record<string, boolean[]>>({});
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // 初期化：保存済みデータをロード
  useEffect(() => {
    const record = getWorkoutRecord(today);
    const init: Record<string, boolean[]> = {};

    todayWorkout.exercises.forEach((ex) => {
      if (record?.exerciseSets?.[ex.name]) {
        // 新形式データがあればそのまま使う
        init[ex.name] = record.exerciseSets[ex.name];
      } else if (record?.completedExercises?.includes(ex.name)) {
        // 旧形式データの場合：全セット完了扱いで変換
        init[ex.name] = Array(ex.sets).fill(true);
      } else {
        // 未記録：全セット未完了
        init[ex.name] = Array(ex.sets).fill(false);
      }
    });

    setSets(init);
    setNote(record?.note ?? "");
    setAlreadyDone(record?.completed ?? false);
  }, [today, todayWorkout.exercises]);

  // セット単体のトグル
  const toggleSet = (exName: string, setIndex: number) => {
    setSets((prev) => {
      const current = [...(prev[exName] || [])];
      current[setIndex] = !current[setIndex];
      return { ...prev, [exName]: current };
    });
    setSaved(false);
  };

  // 全セット一括トグル（カード全体クリック）
  const toggleAllSets = (ex: Exercise) => {
    setSets((prev) => {
      const current = prev[ex.name] || Array(ex.sets).fill(false);
      const allDone = current.slice(0, ex.sets).every(Boolean);
      return { ...prev, [ex.name]: Array(ex.sets).fill(!allDone) };
    });
    setSaved(false);
  };

  // 種目の達成判定
  const isExDone = (ex: Exercise) => {
    const s = sets[ex.name] || [];
    return s.slice(0, ex.sets).every(Boolean);
  };

  const isExPartial = (ex: Exercise) => {
    const s = sets[ex.name] || [];
    const done = s.slice(0, ex.sets).filter(Boolean).length;
    return done > 0 && done < ex.sets;
  };

  const completedSetsCount = (ex: Exercise) =>
    (sets[ex.name] || []).slice(0, ex.sets).filter(Boolean).length;

  // 進捗
  const completedExCount = todayWorkout.exercises.filter(isExDone).length;
  const total = todayWorkout.exercises.length;
  const totalSets = todayWorkout.exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const doneSets = todayWorkout.exercises.reduce(
    (acc, ex) => acc + completedSetsCount(ex),
    0
  );
  const allDone = completedExCount === total;

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
    const completedExercises = todayWorkout.exercises
      .filter(isExDone)
      .map((ex) => ex.name);

    const record: WorkoutRecord = {
      date: today,
      completed: allDone,
      completedExercises,
      exerciseSets: sets,
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#5C3D11]/60">
              セット {doneSets}/{totalSets}
            </span>
            <span className="font-bold text-[#D4A017]">{completedExCount} / {total} 種目</span>
          </div>
        </div>
        <div className="w-full h-3 bg-[#5C3D11]/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D4A017] to-[#F5C842] rounded-full transition-all duration-500"
            style={{ width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
        {allDone && (
          <p className="mt-2 text-center text-sm font-bold text-[#D4A017]">🎉 全種目クリア！お疲れ様！</p>
        )}
      </div>

      {/* エクササイズリスト */}
      <section className="flex flex-col gap-3">
        {todayWorkout.exercises.map((ex: Exercise) => {
          const done = isExDone(ex);
          const partial = isExPartial(ex);
          const doneCount = completedSetsCount(ex);

          return (
            <div
              key={ex.name}
              className={`rounded-2xl border-2 p-4 transition-all duration-200 ${
                done
                  ? "border-[#D4A017] bg-[#D4A017]/10 shadow-[0_2px_12px_rgba(212,160,23,0.2)]"
                  : partial
                  ? "border-[#D4A017]/60 bg-[#D4A017]/5"
                  : "border-[#D4A017]/20 bg-white"
              }`}
            >
              {/* 上段：アイコン・名前・目標セット数 */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => toggleAllSets(ex)}
              >
                {/* 状態アイコン */}
                <div className={`mt-0.5 w-6 h-6 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all text-[10px] font-bold ${
                  done
                    ? "border-[#D4A017] bg-[#D4A017] text-[#2C1A0E]"
                    : partial
                    ? "border-[#D4A017] bg-[#D4A017]/20 text-[#D4A017]"
                    : "border-[#D4A017]/40 text-transparent"
                }`}>
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#2C1A0E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : partial ? (
                    `${doneCount}`
                  ) : null}
                </div>

                {/* 内容 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-bold text-sm ${done ? "text-[#D4A017]" : "text-[#2C1A0E]"}`}>
                      {ex.name}
                    </p>
                    <span className="text-xs text-[#5C3D11]/70 font-semibold bg-[#5C3D11]/10 px-2 py-0.5 rounded-full">
                      {ex.sets}セット × {ex.reps}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#5C3D11]/70 leading-relaxed">{ex.description}</p>
                </div>
              </div>

              {/* セット別チェックボックス */}
              <div className="mt-3 ml-9 flex items-center gap-2 flex-wrap">
                {Array.from({ length: ex.sets }, (_, i) => {
                  const isSetDone = sets[ex.name]?.[i] ?? false;
                  return (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); toggleSet(ex.name, i); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                        isSetDone
                          ? "bg-[#D4A017] text-[#2C1A0E] shadow-[0_2px_8px_rgba(212,160,23,0.35)]"
                          : "border-2 border-[#D4A017]/30 text-[#5C3D11]/60 hover:border-[#D4A017]/60 hover:text-[#5C3D11]"
                      }`}
                    >
                      {isSetDone ? (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#2C1A0E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-current inline-block" />
                      )}
                      SET {i + 1}
                    </button>
                  );
                })}
                {/* 達成セット数 */}
                <span className="ml-1 text-xs text-[#5C3D11]/50">
                  {doneCount}/{ex.sets}
                </span>
              </div>

              {/* 解説動画ボタン */}
              <div className="mt-2 ml-9">
                <a
                  href={ex.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
                  </svg>
                  解説動画を見る
                </a>
              </div>
            </div>
          );
        })}
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

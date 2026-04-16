"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getNotionConfig } from "@/lib/notion";

export default function AdvicePage() {
  const [content, setContent] = useState<string | null>(null);
  const [lastEdited, setLastEdited] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);

  const fetchAdvice = useCallback(async () => {
    const cfg = getNotionConfig();
    if (!cfg?.token || !cfg?.advicePageId) {
      setHasConfig(false);
      return;
    }
    setHasConfig(true);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/notion/advice?token=${encodeURIComponent(cfg.token)}&pageId=${encodeURIComponent(cfg.advicePageId)}`
      );
      const data = await res.json();
      if (data.success) {
        setContent(data.content || "（まだアドバイスがありません）");
        setLastEdited(data.lastEdited);
      } else {
        setError(data.error ?? "取得に失敗しました");
      }
    } catch {
      setError("ネットワークエラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdvice();
  }, [fetchAdvice]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // Markdown風テキストをHTML化して表示
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("# ")) {
        return <h1 key={i} className="text-xl font-bold text-[#2C1A0E] mt-4 mb-2">{line.slice(2)}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-base font-bold text-[#D4A017] mt-4 mb-1.5 border-b border-[#D4A017]/30 pb-1">{line.slice(3)}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={i} className="text-sm font-bold text-[#5C3D11] mt-3 mb-1">{line.slice(4)}</h3>;
      }
      if (line.startsWith("• ") || line.startsWith("・")) {
        return (
          <div key={i} className="flex items-start gap-2 text-sm text-[#2C1A0E] py-0.5">
            <span className="text-[#D4A017] mt-0.5 flex-shrink-0">▸</span>
            <span>{line.slice(2)}</span>
          </div>
        );
      }
      if (line === "---" || line === "") {
        return <div key={i} className={line === "---" ? "border-t border-[#D4A017]/20 my-3" : "h-1"} />;
      }
      return <p key={i} className="text-sm text-[#2C1A0E]/80 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[#5C3D11]/70 hover:text-[#5C3D11] text-sm">← ホームへ</Link>
        <button
          onClick={fetchAdvice}
          disabled={loading || !hasConfig}
          className="text-xs text-[#D4A017] hover:text-[#D4A017]/80 font-semibold disabled:opacity-40"
        >
          {loading ? "読込中..." : "🔄 更新"}
        </button>
      </div>

      {/* タイトルカード */}
      <div className="rounded-2xl bg-[#2C1A0E] px-6 py-5 text-center">
        <span className="text-4xl">🤖</span>
        <h1 className="mt-2 text-xl font-bold text-[#D4A017]">トレーナーからのアドバイス</h1>
        {lastEdited && (
          <p className="mt-1 text-xs text-[#FFF8EC]/50">最終更新: {formatDate(lastEdited)}</p>
        )}
      </div>

      {/* 未設定の場合 */}
      {!hasConfig && (
        <div className="rounded-2xl bg-white border-2 border-[#D4A017]/30 p-6 text-center">
          <span className="text-4xl block mb-3">⚙️</span>
          <p className="text-sm font-bold text-[#2C1A0E] mb-2">Notion連携が未設定です</p>
          <p className="text-xs text-[#5C3D11]/70 mb-4">
            設定ページでNotionのトークンとページIDを設定してください
          </p>
          <Link
            href="/settings"
            className="inline-block px-5 py-2.5 bg-[#D4A017] text-[#2C1A0E] text-sm font-bold rounded-xl hover:bg-[#D4A017]/90 transition-colors"
          >
            設定ページへ →
          </Link>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
          <p className="text-sm text-red-600">❌ {error}</p>
          <button onClick={fetchAdvice} className="mt-2 text-xs text-red-500 underline">再試行</button>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="rounded-2xl bg-white border-2 border-[#D4A017]/30 p-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#D4A017] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-[#5C3D11]/70">アドバイスを取得中...</p>
        </div>
      )}

      {/* アドバイス本文 */}
      {content && !loading && (
        <div className="rounded-2xl bg-white border-2 border-[#D4A017]/30 p-5">
          <div className="flex flex-col gap-0.5">
            {renderContent(content)}
          </div>
        </div>
      )}

      {/* 使い方ガイド */}
      {hasConfig && !loading && (
        <div className="rounded-2xl bg-[#D4A017]/10 border border-[#D4A017]/20 p-4">
          <p className="text-xs font-bold text-[#5C3D11] mb-2">💡 使い方</p>
          <ol className="text-xs text-[#5C3D11]/70 flex flex-col gap-1 list-decimal list-inside">
            <li>各ページで記録を入力・保存</li>
            <li>「Notionに同期」でデータをPCに送信</li>
            <li>PCでClaude Codeを開き「トレーナー」に相談</li>
            <li>このページを更新してアドバイスを受け取る 🦁</li>
          </ol>
        </div>
      )}
    </div>
  );
}

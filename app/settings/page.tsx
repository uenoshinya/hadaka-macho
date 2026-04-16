"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNotionConfig, saveNotionConfig, normalizePageId } from "@/lib/notion";

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [dataSyncPageId, setDataSyncPageId] = useState("");
  const [advicePageId, setAdvicePageId] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const cfg = getNotionConfig();
    if (cfg) {
      setToken(cfg.token);
      setDataSyncPageId(cfg.dataSyncPageId);
      setAdvicePageId(cfg.advicePageId);
    }
  }, []);

  const handleSave = () => {
    saveNotionConfig({
      token: token.trim(),
      dataSyncPageId: normalizePageId(dataSyncPageId.trim()),
      advicePageId: normalizePageId(advicePageId.trim()),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/notion/advice?token=${encodeURIComponent(token.trim())}&pageId=${encodeURIComponent(normalizePageId(advicePageId.trim()))}`
      );
      const data = await res.json();
      if (data.success) {
        setTestResult({ ok: true, msg: `✅ 接続成功！ブロック数: ${data.blockCount}` });
      } else {
        setTestResult({ ok: false, msg: `❌ エラー: ${data.error}` });
      }
    } catch {
      setTestResult({ ok: false, msg: "❌ ネットワークエラー" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[#5C3D11]/70 hover:text-[#5C3D11] text-sm">← ホームへ</Link>
        <span className="text-xs text-[#5C3D11]/50">Notion連携設定</span>
      </div>

      {/* タイトル */}
      <div className="rounded-2xl bg-[#2C1A0E] px-6 py-5 text-center">
        <span className="text-4xl">⚙️</span>
        <h1 className="mt-2 text-xl font-bold text-[#D4A017]">Notion連携設定</h1>
        <p className="mt-1 text-xs text-[#FFF8EC]/60">Claude Codeトレーナーと連携するための設定</p>
      </div>

      {/* 説明 */}
      <div className="rounded-2xl bg-[#D4A017]/10 border border-[#D4A017]/30 p-5">
        <h2 className="text-sm font-bold text-[#5C3D11] mb-3">📖 使い方</h2>
        <ol className="text-xs text-[#5C3D11]/80 flex flex-col gap-2 list-decimal list-inside">
          <li>Notionで2つのページを作成：<br/>
            <span className="font-semibold">① データ同期ページ</span>（アプリ→Claude Code）<br/>
            <span className="font-semibold">② アドバイスページ</span>（Claude Code→アプリ）
          </li>
          <li>Notion Integration Tokenを取得<br/>
            <span className="text-[#5C3D11]/60">notion.so/my-integrations で作成</span>
          </li>
          <li>両ページにIntegrationを接続</li>
          <li>下記に入力して保存</li>
        </ol>
      </div>

      {/* 設定フォーム */}
      <div className="rounded-2xl bg-white border-2 border-[#D4A017]/30 p-5 flex flex-col gap-4">
        <div>
          <label className="text-xs font-bold text-[#5C3D11] block mb-1.5">
            🔑 Notion Integration Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="secret_xxxxxxxxxxxx"
            className="w-full px-3 py-2 text-sm rounded-xl border-2 border-[#D4A017]/20 focus:border-[#D4A017] outline-none bg-[#FFF8EC] text-[#2C1A0E]"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#5C3D11] block mb-1.5">
            📤 データ同期ページID / URL
          </label>
          <input
            type="text"
            value={dataSyncPageId}
            onChange={(e) => setDataSyncPageId(e.target.value)}
            placeholder="https://notion.so/... or ページIDを貼り付け"
            className="w-full px-3 py-2 text-sm rounded-xl border-2 border-[#D4A017]/20 focus:border-[#D4A017] outline-none bg-[#FFF8EC] text-[#2C1A0E]"
          />
          <p className="text-xs text-[#5C3D11]/50 mt-1">アプリのデータをここに書き込む（トレーナーが読む）</p>
        </div>

        <div>
          <label className="text-xs font-bold text-[#5C3D11] block mb-1.5">
            📥 アドバイスページID / URL
          </label>
          <input
            type="text"
            value={advicePageId}
            onChange={(e) => setAdvicePageId(e.target.value)}
            placeholder="https://notion.so/... or ページIDを貼り付け"
            className="w-full px-3 py-2 text-sm rounded-xl border-2 border-[#D4A017]/20 focus:border-[#D4A017] outline-none bg-[#FFF8EC] text-[#2C1A0E]"
          />
          <p className="text-xs text-[#5C3D11]/50 mt-1">トレーナーのアドバイスをここから読む</p>
        </div>

        {/* ボタン群 */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleTest}
            disabled={!token || !advicePageId || testing}
            className="flex-1 py-2.5 rounded-xl border-2 border-[#D4A017] text-[#D4A017] text-sm font-bold hover:bg-[#D4A017]/10 transition-colors disabled:opacity-40"
          >
            {testing ? "確認中..." : "接続テスト"}
          </button>
          <button
            onClick={handleSave}
            disabled={!token || !dataSyncPageId || !advicePageId}
            className="flex-1 py-2.5 rounded-xl bg-[#D4A017] text-[#2C1A0E] text-sm font-bold hover:bg-[#D4A017]/90 transition-colors disabled:opacity-40"
          >
            {saved ? "✅ 保存済み！" : "保存する"}
          </button>
        </div>

        {testResult && (
          <div className={`text-xs rounded-xl px-3 py-2 ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {testResult.msg}
          </div>
        )}
      </div>

      {/* 現在の設定確認 */}
      {token && (
        <div className="rounded-2xl bg-[#5C3D11]/5 border border-[#5C3D11]/10 p-4">
          <p className="text-xs font-bold text-[#5C3D11] mb-2">✅ 現在の設定</p>
          <p className="text-xs text-[#5C3D11]/70">Token: {token.slice(0, 12)}...</p>
          {dataSyncPageId && <p className="text-xs text-[#5C3D11]/70 mt-1">データ同期: 設定済み</p>}
          {advicePageId && <p className="text-xs text-[#5C3D11]/70 mt-1">アドバイス: 設定済み</p>}
        </div>
      )}
    </div>
  );
}

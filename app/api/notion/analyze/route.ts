import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractTextFromBlocks, heading2Block, paragraphBlock, bulletBlock, dividerBlock } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ===== Notion: ページのブロック取得 =====
async function getPageBlocks(pageId: string, token: string): Promise<unknown[]> {
  const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`データ同期ページの読み込みに失敗 [${res.status}]: ${err.message ?? ""}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

// ===== Notion: ページの既存ブロックを全削除 =====
async function clearPageBlocks(pageId: string, token: string): Promise<void> {
  let cursor: string | undefined = undefined;
  while (true) {
    const url: string = cursor
      ? `${NOTION_API}/blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
      : `${NOTION_API}/blocks/${pageId}/children?page_size=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION },
    });
    if (!res.ok) return;
    const data = await res.json();
    const blocks: Array<{ id: string }> = data.results ?? [];

    // 5件ずつバッチ削除（レート制限対策）
    for (let i = 0; i < blocks.length; i += 5) {
      await Promise.all(
        blocks.slice(i, i + 5).map((b) =>
          fetch(`${NOTION_API}/blocks/${b.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION },
            cache: "no-store",
          })
        )
      );
      if (i + 5 < blocks.length) await new Promise((r) => setTimeout(r, 350));
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
}

// ===== Notion: ブロック追加 =====
async function appendBlocks(pageId: string, token: string, blocks: unknown[]): Promise<void> {
  const CHUNK = 100;
  for (let i = 0; i < blocks.length; i += CHUNK) {
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ children: blocks.slice(i, i + CHUNK) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`アドバイスページへの書き込みに失敗 [${res.status}]: ${err.message ?? ""}`);
    }
  }
}

// ===== Claude APIでアドバイス生成 =====
async function generateAdvice(dataText: string): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: `あなたは「裸マッチョへの道」パーソナルトレーナーです。
ユーザーの筋トレ・食事・体重データを分析し、日本語で具体的なアドバイスを提供してください。

アドバイスの形式：
## 🦁 トレーナーからのフィードバック
分析日時: （今日の日付）（JST）

### ⚖️ 体重について
（体重の傾向と目標に向けたコメント）

### 🍽️ 食事について
• （食事内容への具体的なアドバイス）

### 💪 筋トレについて
• （筋トレの達成状況と改善点）

### 🎯 今日・今週のアクション
• （具体的な行動目標）

Keep pushing. Stay hungry. 🦁

注意：
- 厳しすぎず、モチベーションが上がるトーンで
- データがない項目は「記録をつけ続けましょう」と励ます
- 具体的な数字や種目名を使って個別感を出す`,
    messages: [
      {
        role: "user",
        content: `以下は私の最新データです。分析してアドバイスをください。\n\n${dataText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Claude APIから予期しないレスポンス形式");
  return content.text;
}

// ===== ClaudeのテキストをNotionブロックHTMLに変換 =====
function textToNotionBlocks(text: string): unknown[] {
  const LIMIT = 1900;
  const blocks: unknown[] = [];
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, "0")}/${String(jst.getUTCDate()).padStart(2, "0")} ${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;

  blocks.push(heading2Block("🤖 Claude トレーナーからのアドバイス"));
  blocks.push(paragraphBlock(`自動生成: ${dateStr} JST`));
  blocks.push(dividerBlock());

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: trimmed.slice(3).slice(0, LIMIT) } }] } });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: trimmed.slice(4).slice(0, LIMIT) } }] } });
    } else if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
      blocks.push(bulletBlock(trimmed.slice(2).slice(0, LIMIT)));
    } else if (trimmed === "---") {
      blocks.push(dividerBlock());
    } else {
      blocks.push(paragraphBlock(trimmed.slice(0, LIMIT)));
    }
  }
  return blocks;
}

// ===== GET /api/notion/analyze =====
// Vercel Cronから毎日自動実行される。手動でも呼び出し可能。
export async function GET() {
  try {
    const token = process.env.NOTION_TOKEN;
    const dataSyncPageId = process.env.NOTION_DATA_SYNC_PAGE_ID;
    const advicePageId = process.env.NOTION_ADVICE_PAGE_ID;

    if (!token || !dataSyncPageId || !advicePageId) {
      return NextResponse.json({ error: "サーバー環境変数が未設定です" }, { status: 500 });
    }

    // 1. データ同期ページを読む
    const rawBlocks = await getPageBlocks(dataSyncPageId, token);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataText = extractTextFromBlocks(rawBlocks as any[]);

    if (!dataText || dataText.trim().length < 10) {
      return NextResponse.json({ error: "データ同期ページにデータがありません。先にアプリから同期してください。" }, { status: 400 });
    }

    // 2. Claude APIでアドバイス生成
    const advice = await generateAdvice(dataText);

    // 3. アドバイスページを更新
    const notionBlocks = textToNotionBlocks(advice);
    await clearPageBlocks(advicePageId, token);
    await appendBlocks(advicePageId, token, notionBlocks);

    return NextResponse.json({ success: true, message: "アドバイスを生成してNotionに書き込みました" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[notion/analyze] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

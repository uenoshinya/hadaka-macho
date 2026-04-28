import { NextRequest, NextResponse } from "next/server";
import { heading2Block, heading3Block, paragraphBlock, bulletBlock, dividerBlock } from "@/lib/notion";

// キャッシュ無効化（同期のたびに最新データを書き込むため）
export const dynamic = "force-dynamic";
export const runtime = "edge";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Notionのrich_text最大文字数（APIの上限は2000文字）
const NOTION_TEXT_LIMIT = 1900;

// テキストを安全な長さに切り詰める
function safeText(text: string): string {
  if (text.length <= NOTION_TEXT_LIMIT) return text;
  return text.slice(0, NOTION_TEXT_LIMIT) + "…";
}

// レート制限対応のためのスリープ
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Notion APIリクエストをリトライ付きで実行（429対応）
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      // レート制限: 少し待ってリトライ
      const retryAfter = Number(res.headers.get("Retry-After") ?? 1);
      await sleep(retryAfter * 1000);
      continue;
    }
    return res;
  }
  throw new Error("Notion APIのレート制限に繰り返し引っかかりました。しばらく待ってから再試行してください。");
}

// ===== ページの既存ブロックをすべて削除 =====
async function clearPageBlocks(pageId: string, token: string): Promise<void> {
  let cursor: string | undefined = undefined;
  // ページネーション対応：100件を超えるブロックも全削除
  while (true) {
    const url: string = cursor
      ? `${NOTION_API}/blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
      : `${NOTION_API}/blocks/${pageId}/children?page_size=100`;
    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message ?? res.status;
      if (res.status === 401) throw new Error(`Notionトークンが無効です（401）。設定ページでトークンを確認してください。`);
      if (res.status === 403) throw new Error(`Notionページへのアクセスがありません（403）。IntegrationをページにConnectしているか確認してください。`);
      throw new Error(`既存ブロックの取得に失敗しました [${res.status}]: ${msg}`);
    }

    const data = await res.json();
    const blocks: Array<{ id: string }> = data.results ?? [];

    // レート制限対策：5件ずつ順番に削除（並列削除でのレート超過を防止）
    const BATCH_SIZE = 5;
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
      const batch = blocks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((block) =>
          fetchWithRetry(`${NOTION_API}/blocks/${block.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Notion-Version": NOTION_VERSION,
            },
            cache: "no-store",
          })
        )
      );
      // バッチ間に少し間隔を空ける（レート制限対策）
      if (i + BATCH_SIZE < blocks.length) await sleep(350);
    }

    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
}

// ===== ページにブロックを追加（100件ずつ分割して送信）=====
async function appendBlocks(pageId: string, token: string, blocks: unknown[]): Promise<void> {
  // Notion APIは1リクエスト最大100ブロックの制限あり
  const CHUNK_SIZE = 100;
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE);
    const res = await fetchWithRetry(`${NOTION_API}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ children: chunk }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json();
      const code = err.code ?? "";
      const msg = err.message ?? res.status;
      // 401: トークン無効 / 403: アクセス権なし / 400: リクエスト不正
      if (res.status === 401) throw new Error(`Notionトークンが無効です（401）。設定ページでトークンを確認してください。`);
      if (res.status === 403) throw new Error(`Notionページへのアクセスがありません（403）。IntegrationをページにConnectしているか確認してください。`);
      throw new Error(`Notionへの書き込みに失敗 [${res.status}${code ? "/" + code : ""}]: ${msg}`);
    }
    // チャンク間に少し間隔を空ける
    if (i + CHUNK_SIZE < blocks.length) await sleep(350);
  }
}

// ===== POST /api/notion/sync =====
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, pageId, workouts, meals, weights } = body;

    if (!token || !pageId) {
      return NextResponse.json({ error: "token と pageId は必須です" }, { status: 400 });
    }

    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const updatedAt = jstNow.toISOString().replace("T", " ").slice(0, 16);

    const blocks: unknown[] = [
      heading2Block("🦁 裸マッチョへの道 — データ同期"),
      paragraphBlock(`最終同期: ${updatedAt} JST`),
      dividerBlock(),

      // 筋トレ記録
      heading3Block("💪 筋トレ記録（直近7日）"),
    ];

    if (workouts && workouts.length > 0) {
      for (const w of workouts) {
        const status = w.completed ? "✅ 完了" : "❌ 未完";
        const exerciseText = w.completedExercises?.join(", ") || "なし";
        blocks.push(bulletBlock(safeText(`${w.date} — ${w.part} ${status} | 完了種目: ${exerciseText}`)));
        if (w.note) blocks.push(paragraphBlock(safeText(`メモ: ${w.note}`)));
      }
    } else {
      blocks.push(paragraphBlock("（記録なし）"));
    }

    blocks.push(dividerBlock());

    // 食事記録
    blocks.push(heading3Block("🍽️ 食事記録（直近7日）"));

    if (meals && meals.length > 0) {
      for (const m of meals) {
        blocks.push(paragraphBlock(`📅 ${m.date}`));
        if (m.breakfast?.content) blocks.push(bulletBlock(safeText(`朝食: ${m.breakfast.content} ${m.breakfast.calories ? m.breakfast.calories + "kcal" : ""} ${m.breakfast.isEatingOut ? "（外食）" : "（自炊）"}`)));
        if (m.lunch?.content) blocks.push(bulletBlock(safeText(`昼食: ${m.lunch.content} ${m.lunch.calories ? m.lunch.calories + "kcal" : ""} ${m.lunch.isEatingOut ? "（外食）" : "（自炊）"}`)));
        if (m.dinner?.content) blocks.push(bulletBlock(safeText(`夕食: ${m.dinner.content} ${m.dinner.calories ? m.dinner.calories + "kcal" : ""} ${m.dinner.isEatingOut ? "（外食）" : "（自炊）"}`)));
        if (!m.breakfast?.content && !m.lunch?.content && !m.dinner?.content) {
          blocks.push(bulletBlock(`${m.date}: 記録なし`));
        }
      }
    } else {
      blocks.push(paragraphBlock("（記録なし）"));
    }

    blocks.push(dividerBlock());

    // 体重記録
    blocks.push(heading3Block("⚖️ 体重記録（直近30日）"));

    if (weights && weights.length > 0) {
      for (const w of weights) {
        const bf = w.bodyFat ? ` | 体脂肪率: ${w.bodyFat}%` : "";
        blocks.push(bulletBlock(`${w.date}: ${w.weight}kg${bf}`));
      }
    } else {
      blocks.push(paragraphBlock("（記録なし）"));
    }

    // ページクリア → 新しいデータを書き込み
    await clearPageBlocks(pageId, token);
    await appendBlocks(pageId, token, blocks);

    return NextResponse.json({ success: true, updatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[notion/sync] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

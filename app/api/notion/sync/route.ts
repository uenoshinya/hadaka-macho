import { NextRequest, NextResponse } from "next/server";
import { heading2Block, heading3Block, paragraphBlock, bulletBlock, dividerBlock } from "@/lib/notion";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ===== ページの既存ブロックをすべて削除 =====
async function clearPageBlocks(pageId: string, token: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
  });
  if (!res.ok) return;
  const data = await res.json();
  const blocks: Array<{ id: string }> = data.results ?? [];

  await Promise.all(
    blocks.map((block) =>
      fetch(`${NOTION_API}/blocks/${block.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
        },
      })
    )
  );
}

// ===== ページにブロックを追加 =====
async function appendBlocks(pageId: string, token: string, blocks: unknown[]): Promise<void> {
  await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ children: blocks }),
  });
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
        blocks.push(bulletBlock(`${w.date} — ${w.part} ${status} | 完了種目: ${w.completedExercises?.join(", ") || "なし"}`));
        if (w.note) blocks.push(paragraphBlock(`  メモ: ${w.note}`));
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
        if (m.breakfast?.content) blocks.push(bulletBlock(`朝食: ${m.breakfast.content} ${m.breakfast.calories ? m.breakfast.calories + "kcal" : ""} ${m.breakfast.isEatingOut ? "（外食）" : "（自炊）"}`));
        if (m.lunch?.content) blocks.push(bulletBlock(`昼食: ${m.lunch.content} ${m.lunch.calories ? m.lunch.calories + "kcal" : ""} ${m.lunch.isEatingOut ? "（外食）" : "（自炊）"}`));
        if (m.dinner?.content) blocks.push(bulletBlock(`夕食: ${m.dinner.content} ${m.dinner.calories ? m.dinner.calories + "kcal" : ""} ${m.dinner.isEatingOut ? "（外食）" : "（自炊）"}`));
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
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

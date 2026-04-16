import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBlocks } from "@/lib/notion";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ===== GET /api/notion/advice =====
// トレーナーが書いたアドバイスページを取得して返す
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const pageId = searchParams.get("pageId");

    if (!token || !pageId) {
      return NextResponse.json({ error: "token と pageId は必須です" }, { status: 400 });
    }

    // ページのブロックを取得
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.message ?? "Notion APIエラー" }, { status: res.status });
    }

    const data = await res.json();
    const blocks = data.results ?? [];

    // ページプロパティも取得（最終更新日時用）
    const pageRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    const pageData = pageRes.ok ? await pageRes.json() : null;
    const lastEdited = pageData?.last_edited_time ?? null;

    const content = extractTextFromBlocks(blocks);

    return NextResponse.json({
      success: true,
      content,
      lastEdited,
      blockCount: blocks.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

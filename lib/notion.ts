// ===== Notion設定の型定義 =====

export interface NotionConfig {
  token: string;
  dataSyncPageId: string; // アプリデータ → Notion（トレーナーが読む）
  advicePageId: string;   // トレーナーが書く → アプリが読む
}

// ===== localStorage キー =====
const NOTION_CONFIG_KEY = "hadaka_notion_config";

export function getNotionConfig(): NotionConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(NOTION_CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function saveNotionConfig(config: NotionConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTION_CONFIG_KEY, JSON.stringify(config));
}

// ===== ページIDの正規化 (URL形式 or ハイフンなし形式 → UUID形式) =====
export function normalizePageId(input: string): string {
  // URLからIDを抽出
  const urlMatch = input.match(/([a-f0-9]{32})(?:[?#]|$)/i);
  if (urlMatch) {
    const id = urlMatch[1];
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }
  // すでにUUID形式
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input)) {
    return input;
  }
  // ハイフンなし32文字
  if (/^[a-f0-9]{32}$/i.test(input)) {
    return `${input.slice(0, 8)}-${input.slice(8, 12)}-${input.slice(12, 16)}-${input.slice(16, 20)}-${input.slice(20)}`;
  }
  return input;
}

// ===== Notionブロック生成ヘルパー =====
type NotionBlock = Record<string, unknown>;

export function heading2Block(text: string): NotionBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

export function heading3Block(text: string): NotionBlock {
  return {
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

export function paragraphBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

export function dividerBlock(): NotionBlock {
  return { object: "block", type: "divider", divider: {} };
}

export function bulletBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

// ===== Notionブロックからテキスト抽出 =====
export function extractTextFromBlocks(blocks: NotionBlock[]): string {
  return blocks
    .map((block) => {
      const type = block.type as string;
      const content = block[type] as { rich_text?: Array<{ plain_text: string }> } | undefined;
      if (!content) return "";
      if (type === "divider") return "\n---\n";
      const richText = content.rich_text ?? [];
      const text = richText.map((rt) => rt.plain_text).join("");
      if (type === "heading_1") return `# ${text}`;
      if (type === "heading_2") return `## ${text}`;
      if (type === "heading_3") return `### ${text}`;
      if (type === "bulleted_list_item") return `• ${text}`;
      if (type === "numbered_list_item") return `・${text}`;
      if (type === "code") return `\`${text}\``;
      return text;
    })
    .filter(Boolean)
    .join("\n");
}

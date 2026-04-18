# 🦁 裸マッチョへの道 仕様書 v1.2
> 作成日：2026-04-15 ／ 最終更新：2026-04-18

---

## 1. サービス概要

| 項目 | 内容 |
|---|---|
| **サービス名** | 裸マッチョへの道 |
| **コンセプト** | 家トレ・食事・体重を一元管理する個人用健康管理アプリ |
| **ターゲット** | 自分（個人利用） |
| **提供形態** | Webアプリ（スマホ・PC対応） |
| **目標** | 減量しながら筋肉をつけて裸マッチョになる |

---

## 2. 機能一覧

### 実装済み ✅

| ページ | 機能 |
|---|---|
| `/`（ホーム） | 今日のトレーニング概要・食事/体重のステータス・モチベバナー |
| `/workout` | 今日の筋トレチェックリスト・進捗バー・メモ保存 |
| `/meals` | 朝食/昼食/夕食のテキスト記録・自炊/外食チェック・個別保存・いつでも更新OK |
| `/weight` | 体重・体脂肪率記録・週間バーグラフ・履歴一覧・いつでも上書き更新 |
| `/advice` | NotionからClaudeのフィードバックを取得して表示 |
| `/settings` | Notion連携設定（token・pageID保存・接続テスト） |

### 未実装 📋

| 機能 | 優先度 | メモ |
|---|---|---|
| リマインド通知（17:30） | 🟡 中 | Web Notifications API 実装済み（scheduleReminder()）、UI未接続 |
| 週次サマリー画面 | 🟢 低 | 一週間の筋トレ達成率・カロリー平均など |
| デバイス間同期 | 🟢 低 | Vercel + Supabase（Phase 2） |

---

## 3. Claudeトレーナー連携フロー

```
スマホアプリ
  ↓ 「Notionに同期」ボタン
Vercel API（/api/notion/sync）
  ↓ データ書き込み
Notionデータ同期ページ（📤）
  ↓ Claude Codeが読み込み・分析
Notionアドバイスページ（📥）
  ↓ アプリが取得（/api/notion/advice）
スマホアプリ「アドバイス」タブ
```

### Notion設定（スマホ・PCそれぞれで設定ページに入力が必要）

| 項目 | 値 |
|---|---|
| Integration名 | 裸マッチョ |
| データ同期ページID | `344f6e96-b8cf-802a-b71e-fba222e5979e` |
| アドバイスページID | `344f6e96-b8cf-80e1-83c4-f6e75836616c` |

> ⚠️ **重要**：Notionの各ページ右上「…」→「Connections」→「裸マッチョ」Integration を**両ページとも接続**しないと同期・読み取りができない。

---

## 4. 筋トレメニュー（週間ルーティン）

| 曜日 | 部位 | 主な種目 |
|---|---|---|
| 日 | 休息 | ストレッチ・深呼吸 |
| 月 | 胸 | ノーマル/ワイド/ダイヤモンドプッシュアップ等 5種目 |
| 火 | 背中 | 懸垂各種・インバーテッドロウ 4種目 |
| 水 | 脚・体幹 | スクワット・ランジ・プランク等 5種目 |
| 木 | 肩・腕 | パイクプッシュアップ・ディップス等 4種目 |
| 金 | 胸（強化） | アーチャー・爆発的・スロープッシュアップ等 4種目 |
| 土 | 背中（強化） | 懸垂最大回数・ネガティブ・L字 4種目 |

---

## 5. 食事記録仕様

- 朝食 / 昼食 / 夕食 を個別に記録・個別保存
- 各食事に：テキストメモ・自炊/外食トグル
- **いつでも更新OK**（1日1回制限なし）
- 日付は **JST（日本標準時）基準で0時に切り替わる**

---

## 6. データ設計（localStorage）

| キー | 内容 |
|---|---|
| `hadaka_workout_YYYY-MM-DD` | WorkoutRecord（完了フラグ・チェック済み種目・メモ） |
| `hadaka_meal_YYYY-MM-DD` | MealRecord（朝昼夕各エントリ・メモ） |
| `hadaka_weights` | WeightRecord[]（全体重履歴配列・日付順） |
| `hadaka_notion_config` | NotionConfig（token・dataSyncPageId・advicePageId） |

> ⚠️ **localStorageはブラウザ・デバイスごとに独立**。スマホとPCで別々に設定が必要。ブラウザのキャッシュクリアで消えることがある。

---

## 7. デザイン

| 項目 | 値 |
|---|---|
| テーマ | ライオン（力強さ・気高さ） |
| メインカラー | ゴールド `#D4A017` |
| ダークカラー | ブラウン `#2C1A0E` |
| サブカラー | `#5C3D11` |
| 背景 | クリーム `#FFF8EC` |
| リマインド文言 | 🦁 Keep pushing. Stay hungry. |

---

## 8. 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16（App Router）+ TypeScript |
| スタイリング | Tailwind CSS |
| データ | localStorage（クライアントのみ） |
| デプロイ | Vercel（本番URL: https://hadaka-macho.vercel.app） |
| GitHub | https://github.com/uenoshinya/hadaka-macho |

---

## 9. ファイル構成

```
app/
├── app/
│   ├── layout.tsx                  # 共通レイアウト・ナビゲーション
│   ├── page.tsx                    # ホーム
│   ├── workout/page.tsx            # 筋トレ記録
│   ├── meals/page.tsx              # 食事記録
│   ├── weight/page.tsx             # 体重記録・グラフ
│   ├── advice/page.tsx             # Claudeフィードバック表示
│   ├── settings/page.tsx           # Notion連携設定
│   └── api/notion/
│       ├── sync/route.ts           # POST: アプリ→Notion書き込み
│       └── advice/route.ts         # GET: Notionアドバイス読み取り
├── data/
│   └── workout.ts                  # 週間メニューデータ
└── lib/
    ├── storage.ts                  # localStorageユーティリティ・型定義
    └── notion.ts                   # Notionブロックヘルパー・設定管理
```

---

## 10. 既知のバグ対応履歴

### 2026-04-18 対応

#### Bug 1: JSTタイムゾーンバグ（重要度：高）
- **症状**: 日本時間の0時〜8時59分の間、アプリの日付が前日になる。その時間帯に記録したデータが翌日扱いにならない。
- **原因**: `toDateString()` が `new Date().toISOString()` を使っており、UTCベースで日付を計算していた。
- **修正**: `lib/storage.ts` の `toDateString()` と `getWeekDates()` をJST（UTC+9）基準に変更。ホームの日付表示も同様に修正。
- **修正ファイル**: `lib/storage.ts`, `app/page.tsx`

#### Bug 2: Notion同期エラーメッセージが不明確（重要度：中）
- **症状**: 同期失敗時に「書き込みに失敗」としか表示されず原因がわからない。
- **修正**: 401（トークン無効）・403（アクセス権なし）・その他を区別した詳細メッセージに変更。
- **修正ファイル**: `app/api/notion/sync/route.ts`

#### Bug 3: Notion同期の100件超ブロック未対応（重要度：低）
- **症状**: ページに100件以上のブロックがある場合、古いブロックが残り続ける。
- **修正**: `clearPageBlocks()` をページネーション対応（whileループ）に変更。並列削除で速度維持。
- **修正ファイル**: `app/api/notion/sync/route.ts`

---

### Notion連携トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| 「設定ページでNotionを設定してください」 | スマホのlocalStorageに設定がない | スマホで設定ページ（⚙️）を開いてtoken・pageIDを入力して保存 |
| 「Notionトークンが無効です（401）」 | tokenが間違っている | notion.so/my-integrationsでtokenを再確認・入力し直す |
| 「Notionページへのアクセスがありません（403）」 | IntegrationがNotionページに未接続 | 各ページ右上「…」→Connections→Integrationを接続 |
| 接続テストはOKだが同期でエラー | データ同期ページにIntegrationが未接続 | データ同期ページにもConnectionsで接続する |
| PCは動くがスマホでエラー | スマホのlocalStorageの設定が異なる | スマホの設定ページで正しいtokenとpageIDを入力し直す |

---

## 11. 開発ロードマップ

### Phase 1 - MVP ✅ 完了
- [x] 技術スタック・デザイン決定
- [x] データ設計（storage.ts）
- [x] 週間筋トレメニュー（workout.ts）
- [x] ホーム画面
- [x] 筋トレ記録画面
- [x] 食事記録画面（朝昼夜分離・個別保存・自炊/外食）
- [x] 体重記録画面（週間グラフ）
- [x] Vercel デプロイ
- [x] Notion連携（Claude トレーナーフィードバック）
- [x] JSTタイムゾーン対応

### Phase 2 - 拡張
- [ ] リマインド通知 UI（17:30 プッシュ通知の有効化ボタン）
- [ ] 週次サマリー画面
- [ ] Supabase 連携（クロスデバイス同期）

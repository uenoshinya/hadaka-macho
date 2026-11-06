/**
 * ============================================================
 *  CLOSET CHECK - サーバー側処理（Google Apps Script）
 * ============================================================
 *  「なんとなく買う」をなくし、納得して洋服を購入する。
 *
 *  このファイルの構成
 *    1. 設定（CONFIG）……… 変更したい値はまずここを見る
 *    2. 初期データ ………… チェック項目・設定の初期値
 *    3. 初期化処理 ………… setupSpreadsheet()（最初に 1 回実行）
 *    4. 共通処理 ……………… シート取得・自動作成など
 * ============================================================
 */

/* ============================================================
 * 1. 設定（CONFIG）
 *    スプレッドシート ID やシート名など「コード側の固定値」は
 *    すべてここにまとめています。
 * ============================================================ */
const CONFIG = {
  // スプレッドシート ID
  //   空のまま  … このスクリプトが紐付いているスプレッドシートを使う（推奨）
  //   ID を記入 … 別のスプレッドシートを使う
  //   ※ ID は URL の https://docs.google.com/spreadsheets/d/【ここ】/edit の部分
  SPREADSHEET_ID: '',

  // 日時の表記に使うタイムゾーン
  TIMEZONE: 'Asia/Tokyo',

  // 保存処理のロック待ち時間（ミリ秒）。他の保存が終わるのを最大この時間だけ待つ
  LOCK_TIMEOUT_MS: 10000,

  // シート定義（シート名と列の並び）
  //   ※ 列の並びを変えるとデータがずれるので、変更しないでください
  SHEETS: {
    CHECKLIST: {
      name: 'Checklist',
      headers: ['item_id', 'category', 'item_name', 'target_type', 'severity', 'active', 'display_order']
    },
    HISTORY: {
      name: 'PurchaseHistory',
      headers: [
        'record_id', 'created_at', 'product_name', 'brand', 'category', 'condition_type', 'price',
        'condition_result', 'fitting_result', 'judgment', 'memo', 'checked_items_json'
      ]
    },
    SETTINGS: {
      name: 'Settings',
      headers: ['key', 'value', 'description']
    }
  },

  // Checklist シートで使える値
  TARGET_TYPES: ['vintage', 'fitting', 'both'],
  SEVERITIES: ['normal', 'warning', 'critical'],

  // 判定の表記（左から良い順。総合判定は「悪い方」を採用する）
  JUDGMENTS: ['買い', '要検討', '見送り'],
  NOT_PERFORMED: '未実施',

  // チェックの種類と、それぞれに含める Checklist の target_type
  //   vintage = 古着の状態（condition_result）／ fitting = 試着（fitting_result）
  MODES: {
    vintage: { label: '古着の状態', targets: ['vintage', 'both'] },
    fitting: { label: '試着・フィット感', targets: ['fitting', 'both'] }
  },

  // チェック項目の状態
  STATUS_OK: 'ok',            // 問題なし
  STATUS_CONCERN: 'concern',  // 気になる

  // 古着 / 新品 の表記
  CONDITION_TYPES: ['古着', '新品'],

  // NG例の見本画像の上限サイズ（バイト）。大きすぎると店頭で表示に時間がかかるため
  GUIDE_IMAGE_MAX_BYTES: 5 * 1024 * 1024,

  // ヘッダー行の見た目（アプリと同じネイビー）
  HEADER_BG: '#1B2A41',
  HEADER_FONT: '#FFFFFF'
};


/* ============================================================
 * 2. 初期データ
 *    setupSpreadsheet() で、シートが空のときだけ書き込みます。
 *    運用開始後はスプレッドシート側で直接編集してください。
 * ============================================================ */

/**
 * チェック項目の初期データ
 *   [item_id, category, item_name, target_type, severity, active, display_order]
 *
 *   severity の意味
 *     critical … 1 つでも「気になる」なら「見送り」（重大な注意項目）
 *     warning  … 「要検討」の原因になる注意項目
 *     normal   … 軽微な項目（複数重なると「要検討」）
 */
const DEFAULT_CHECKLIST = [
  // ---------- 古着の状態チェック（vintage） ----------
  ['C01', 'A. 生地の状態', '生地が薄くなっていないか（肘・膝・お尻）', 'vintage', 'critical', true, 10],
  ['C02', 'A. 生地の状態', '生地を軽く引っ張って弱くなっていないか', 'vintage', 'critical', true, 20],
  ['C03', 'A. 生地の状態', '毛玉・毛羽立ちがひどくないか', 'vintage', 'normal', true, 30],
  ['C04', 'A. 生地の状態', '虫食いや小さな穴がないか', 'vintage', 'critical', true, 40],
  ['C05', 'A. 生地の状態', '不自然なテカリや変色がないか', 'vintage', 'warning', true, 50],

  ['C06', 'B. シミ・汚れ', '襟元に黄ばみや皮脂汚れがないか', 'vintage', 'warning', true, 60],
  ['C07', 'B. シミ・汚れ', '脇の下に汗ジミがないか', 'vintage', 'warning', true, 70],
  ['C08', 'B. シミ・汚れ', '袖口・裾に黒ずみがないか', 'vintage', 'normal', true, 80],
  ['C09', 'B. シミ・汚れ', '前面・背面に目立つシミがないか', 'vintage', 'warning', true, 90],
  ['C10', 'B. シミ・汚れ', '裏地やポケット内部に汚れがないか', 'vintage', 'normal', true, 100],

  ['C11', 'C. ダメージ・縫製', '脇・股・お尻などの縫い目が裂けていないか', 'vintage', 'critical', true, 110],
  ['C12', 'C. ダメージ・縫製', 'ボタンが欠損していないか', 'vintage', 'normal', true, 120],
  ['C13', 'C. ダメージ・縫製', 'ファスナーがスムーズに動くか', 'vintage', 'warning', true, 130],
  ['C14', 'C. ダメージ・縫製', '裏地が破れたり、ほつれたりしていないか', 'vintage', 'critical', true, 140],
  ['C15', 'C. ダメージ・縫製', '裾や袖口が擦り切れていないか', 'vintage', 'warning', true, 150],

  ['C16', 'D. ニオイ・その他', 'カビ臭がしないか', 'vintage', 'critical', true, 160],
  ['C17', 'D. ニオイ・その他', 'タバコ臭・強い香水臭がないか', 'vintage', 'warning', true, 170],
  ['C18', 'D. ニオイ・その他', '保管臭が強く残っていないか', 'vintage', 'warning', true, 180],
  ['C19', 'D. ニオイ・その他', 'ブランドタグ・洗濯表示が残っているか', 'vintage', 'normal', true, 190],
  ['C20', 'D. ニオイ・その他', '補修跡やリペア箇所がないか', 'vintage', 'normal', true, 200],

  // ---------- 試着・フィット感チェック（fitting） ----------
  ['F01', 'A. 肩・身幅', '肩の縫い目が肩先と大きくズレていないか', 'fitting', 'warning', true, 1010],
  ['F02', 'A. 肩・身幅', '胸・背中に不自然なシワが寄っていないか', 'fitting', 'normal', true, 1020],
  ['F03', 'A. 肩・身幅', 'ボタンを留めても胸やお腹が引っ張られないか', 'fitting', 'critical', true, 1030],
  ['F04', 'A. 肩・身幅', '身幅が大きすぎないか', 'fitting', 'warning', true, 1040],
  ['F05', 'A. 肩・身幅', '腕を前に伸ばしても窮屈ではないか', 'fitting', 'critical', true, 1050],

  ['F06', 'B. 着丈・袖丈', '着丈が長すぎたり短すぎたりしないか', 'fitting', 'warning', true, 1060],
  ['F07', 'B. 着丈・袖丈', 'お尻がどの程度隠れるか確認したか', 'fitting', 'normal', true, 1070],
  ['F08', 'B. 着丈・袖丈', '袖丈が手の甲にかかりすぎていないか', 'fitting', 'normal', true, 1080],
  ['F09', 'B. 着丈・袖丈', 'シャツの袖口がジャケットから適度に見えるか', 'fitting', 'normal', true, 1090],
  ['F10', 'B. 着丈・袖丈', '重ね着を想定した長さか', 'fitting', 'normal', true, 1100],

  ['F11', 'C. パンツのサイズ感', 'ウエストが苦しくなく、ずり落ちもしないか', 'fitting', 'critical', true, 1110],
  ['F12', 'C. パンツのサイズ感', '太ももに適度な余裕があるか', 'fitting', 'warning', true, 1120],
  ['F13', 'C. パンツのサイズ感', '股上が浅すぎたり深すぎたりしないか', 'fitting', 'warning', true, 1130],
  ['F14', 'C. パンツのサイズ感', 'お尻や股に引っ張られるシワが出ていないか', 'fitting', 'warning', true, 1140],
  ['F15', 'C. パンツのサイズ感', '裾丈が靴と合わせて自然に見えるか', 'fitting', 'normal', true, 1150],

  ['F16', 'D. 動作・全体バランス', '腕を上げても突っ張らないか', 'fitting', 'warning', true, 1160],
  ['F17', 'D. 動作・全体バランス', '椅子に座っても窮屈ではないか', 'fitting', 'critical', true, 1170],
  ['F18', 'D. 動作・全体バランス', '歩いたときに裾や股が引っかからないか', 'fitting', 'warning', true, 1180],
  ['F19', 'D. 動作・全体バランス', '正面・横・後ろのシルエットを確認したか', 'fitting', 'normal', true, 1190],
  ['F20', 'D. 動作・全体バランス', '手持ちの服や靴と合わせられそうか', 'fitting', 'normal', true, 1200]
];

/**
 * 設定の初期データ [key, value, description]
 *   Settings シートに無いキーだけ追加します（既に編集した値は上書きしません）。
 */
const DEFAULT_SETTINGS = [
  ['APP_NAME', 'CLOSET CHECK', 'アプリ名（画面上部に表示）'],
  ['CATEGORY_OPTIONS', 'シャツ,Tシャツ,ニット,ジャケット,コート,パンツ,その他', '商品カテゴリーの選択肢（カンマ区切り）'],
  ['WARNING_SKIP_THRESHOLD', 3, 'warning 項目の「気になる」がこの数以上で「見送り」'],
  ['NORMAL_CONSIDER_THRESHOLD', 3, 'normal 項目の「気になる」がこの数以上で「要検討」'],
  ['MIN_PROGRESS_FOR_BUY', 0.8, '「買い」と判定するのに必要な最低進捗率（0〜1）'],
  ['PRICE_MAX', 10000000, '入力できる価格の上限（円）'],
  ['HISTORY_LIMIT', 100, '購入履歴に表示する最大件数'],
  ['GUIDE_IMAGE_FILE_ID', '', 'NG例の見本画像（Googleドライブ）のファイル ID または共有 URL。空なら表示しない']
];


/* ============================================================
 * 3. 初期化処理
 * ============================================================ */

/**
 * スプレッドシートを初期化します。【最初に 1 回実行してください】
 *
 *   ・Checklist / PurchaseHistory / Settings シートが無ければ作成
 *   ・Checklist が空なら初期チェック項目を書き込み
 *   ・Settings に無い設定キーを追加
 *
 *   何度実行しても、既に入っているデータは消えません（安全に再実行できます）。
 */
function setupSpreadsheet() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  const messages = [];
  try {
    const ss = getSpreadsheet_();
    const created = ensureSheets_();
    created.forEach(function (name) { messages.push('シート「' + name + '」を作成しました'); });

    messages.push(seedChecklist_(ss));
    messages.push(seedSettings_(ss));

    applySheetFormats_(ss);
    removeEmptyDefaultSheet_(ss);
  } finally {
    lock.releaseLock();
  }

  const summary = '【CLOSET CHECK】初期化が完了しました\n・' + messages.join('\n・');
  Logger.log(summary);
  showAlertIfPossible_(summary);
  return summary;
}

/**
 * スプレッドシートを開いたときに「CLOSET CHECK」メニューを追加します。
 * （コンテナバインド型のときだけ動作します）
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CLOSET CHECK')
    .addItem('初期化（シート作成）', 'setupSpreadsheet')
    .addToUi();
}

/**
 * Checklist シートが空（ヘッダーのみ）なら初期チェック項目を書き込みます。
 * @return {string} 結果メッセージ
 */
function seedChecklist_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CHECKLIST.name);
  if (sheet.getLastRow() > 1) {
    return 'Checklist には既にデータがあるため、初期項目の書き込みをスキップしました';
  }
  sheet.getRange(2, 1, DEFAULT_CHECKLIST.length, DEFAULT_CHECKLIST[0].length)
    .setValues(DEFAULT_CHECKLIST);
  return 'Checklist に初期チェック項目を ' + DEFAULT_CHECKLIST.length + ' 件書き込みました';
}

/**
 * Settings シートに存在しないキーだけ追加します。
 * @return {string} 結果メッセージ
 */
function seedSettings_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS.name);
  const lastRow = sheet.getLastRow();

  // 既に登録されているキーの一覧
  const existingKeys = {};
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (row) {
      existingKeys[String(row[0]).trim()] = true;
    });
  }

  const rowsToAdd = DEFAULT_SETTINGS.filter(function (row) { return !existingKeys[row[0]]; });
  if (rowsToAdd.length === 0) {
    return 'Settings は最新です（追加なし）';
  }
  sheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  return 'Settings に設定を ' + rowsToAdd.length + ' 件追加しました';
}

/**
 * 各シートの見た目と入力ルールを整えます。
 *   ・Checklist：active をチェックボックス、target_type / severity をプルダウンに
 *   ・PurchaseHistory：日時と価格の表示形式
 *   ※ 何度実行しても結果は同じになります
 */
function applySheetFormats_(ss) {
  const maxRows = 1000; // 入力ルールを設定する行数（足りなくなったら増やしてください）

  // ---- Checklist ----
  const checklist = ss.getSheetByName(CONFIG.SHEETS.CHECKLIST.name);
  const ch = CONFIG.SHEETS.CHECKLIST.headers;
  checklist.getRange(2, ch.indexOf('target_type') + 1, maxRows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.TARGET_TYPES, true).setAllowInvalid(false).build()
  );
  checklist.getRange(2, ch.indexOf('severity') + 1, maxRows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.SEVERITIES, true).setAllowInvalid(false).build()
  );
  checklist.getRange(2, ch.indexOf('active') + 1, maxRows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().build()
  );
  checklist.setColumnWidth(ch.indexOf('category') + 1, 160);
  checklist.setColumnWidth(ch.indexOf('item_name') + 1, 360);

  // ---- PurchaseHistory ----
  const history = ss.getSheetByName(CONFIG.SHEETS.HISTORY.name);
  const hh = CONFIG.SHEETS.HISTORY.headers;
  history.getRange(2, hh.indexOf('created_at') + 1, maxRows, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  history.getRange(2, hh.indexOf('price') + 1, maxRows, 1).setNumberFormat('#,##0');
  // JSON 列は長くなるので折り返さず、幅を固定
  history.getRange(2, hh.indexOf('checked_items_json') + 1, maxRows, 1)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  history.setColumnWidth(hh.indexOf('checked_items_json') + 1, 300);

  // ---- Settings ----
  const settings = ss.getSheetByName(CONFIG.SHEETS.SETTINGS.name);
  settings.setColumnWidth(2, 360);
  settings.setColumnWidth(3, 380);
}

/**
 * 新規スプレッドシートに最初からある空の「シート1」を削除します。
 * データが入っている場合や、アプリ用シートの場合は削除しません。
 */
function removeEmptyDefaultSheet_(ss) {
  const appSheetNames = Object.keys(CONFIG.SHEETS).map(function (k) { return CONFIG.SHEETS[k].name; });
  ['シート1', 'Sheet1'].forEach(function (name) {
    if (appSheetNames.indexOf(name) !== -1) return;
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
    }
  });
}

/**
 * スプレッドシート上で実行したときだけ完了メッセージを表示します。
 * （GAS エディタから実行した場合は「実行ログ」で確認できます）
 */
function showAlertIfPossible_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    // エディタや Web アプリから実行した場合は UI が使えないので何もしない
  }
}


/* ============================================================
 * 4. 共通処理
 * ============================================================ */

/**
 * 使用するスプレッドシートを取得します。
 * CONFIG.SPREADSHEET_ID が空なら、紐付いているスプレッドシートを使います。
 */
function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'スプレッドシートが見つかりません。スプレッドシートの「拡張機能 → Apps Script」から作成するか、' +
      'Code.gs の CONFIG.SPREADSHEET_ID にスプレッドシート ID を設定してください。'
    );
  }
  return ss;
}

/**
 * 必要なシートがすべて存在することを保証します。
 *   ・シートが無ければ、ヘッダー付きで作成
 *   ・シートはあるが空なら、ヘッダーを書き込み
 *   ・ヘッダーが想定と違えば、データ破損を防ぐためエラーにする
 *     （右側に列を追加するのは OK）
 *
 * 各 API の入口で呼ぶので、誤ってシートを消しても自動で復旧します。
 * @return {string[]} 新しく作成したシート名の一覧
 */
function ensureSheets_() {
  const ss = getSpreadsheet_();
  const created = [];

  Object.keys(CONFIG.SHEETS).forEach(function (key) {
    const def = CONFIG.SHEETS[key];
    let sheet = ss.getSheetByName(def.name);

    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      created.push(def.name);
    }

    if (sheet.getLastRow() === 0) {
      writeHeader_(sheet, def.headers);
      return;
    }

    // 既存シートのヘッダーを確認
    const actual = sheet.getRange(1, 1, 1, def.headers.length).getValues()[0]
      .map(function (v) { return String(v).trim(); });
    const mismatch = def.headers.filter(function (h, i) { return actual[i] !== h; });
    if (mismatch.length > 0) {
      throw new Error(
        'シート「' + def.name + '」の 1 行目（見出し）が想定と異なります。' +
        '想定：' + def.headers.join(', ') + ' ／ 実際：' + actual.join(', ')
      );
    }
  });

  return created;
}

/** ヘッダー行を書き込み、見た目を整えて固定します */
function writeHeader_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground(CONFIG.HEADER_BG)
    .setFontColor(CONFIG.HEADER_FONT);
  sheet.setFrozenRows(1);
}


/* ============================================================
 * 5. 画面の配信
 * ============================================================ */

/**
 * Web アプリにアクセスしたときに画面（Index.html）を返します。
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('CLOSET CHECK')
    // スマートフォンで正しい幅で表示するための設定（HTML 内の meta タグは GAS では無効なためここで指定）
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * 別ファイルの HTML（Style.html / JavaScript.html）を読み込みます。
 * Index.html の中で <?!= include('Style'); ?> のように使います。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/* ============================================================
 * 6. 画面から呼び出す API（google.script.run）
 * ============================================================ */

/**
 * アプリ起動時に必要なデータをまとめて返します。
 * 店頭での通信回数を減らすため、起動時に 1 回だけ呼びます。
 *
 * @return {{appName: string, settings: Object, items: Object[], warnings: string[]}}
 */
function getInitialData() {
  ensureSheets_();
  const settings = readSettings_();
  const checklist = readChecklist_();
  return {
    appName: settings.APP_NAME,
    settings: settings,
    items: checklist.items,
    warnings: checklist.warnings,
    hasGuideImage: settings.GUIDE_IMAGE_FILE_ID !== ''
  };
}

/**
 * チェック結果から購入判定を計算して返します（判定画面を開くときに呼ぶ）。
 *
 * @param {{statuses: Object, excluded: string[]}} payload
 *   statuses … { item_id: 'ok' | 'concern' }（未確認の項目は含めない）
 *   excluded … 対象外にしたカテゴリー（'fitting|C. パンツのサイズ感' の形）
 * @return {Object} judgeChecks_() の結果
 */
function evaluateCheck(payload) {
  ensureSheets_();
  const input = validateCheckPayload_(payload);
  return judgeChecks_(input.statuses, input.excluded, readChecklist_().items, readSettings_());
}

/**
 * NG例の見本画像を読み込み、画面にそのまま表示できる形（data URL）で返します。
 * 画像は「NG例を見る」を押したときにだけ読み込むので、アプリの起動は遅くなりません。
 *
 * 画像は Googleドライブに置き、Settings シートの GUIDE_IMAGE_FILE_ID に
 * ファイル ID か共有 URL を書いてください（共有設定は「自分のみ」のままで OK）。
 *
 * @return {string} 'data:image/...;base64,...'
 */
function getGuideImage() {
  const raw = readSettings_().GUIDE_IMAGE_FILE_ID;
  const fileId = extractDriveFileId_(raw);
  if (!fileId) {
    throw new Error('Settings シートの GUIDE_IMAGE_FILE_ID に画像のファイル ID が設定されていません。');
  }

  let blob;
  try {
    blob = DriveApp.getFileById(fileId).getBlob();
  } catch (e) {
    throw new Error('見本画像が見つかりません。GUIDE_IMAGE_FILE_ID が正しいか、ファイルがゴミ箱に入っていないか確認してください。');
  }

  const mimeType = blob.getContentType();
  if (!mimeType || mimeType.indexOf('image/') !== 0) {
    throw new Error('GUIDE_IMAGE_FILE_ID のファイルが画像ではありません（' + mimeType + '）。');
  }
  const bytes = blob.getBytes();
  if (bytes.length > CONFIG.GUIDE_IMAGE_MAX_BYTES) {
    throw new Error('見本画像が大きすぎます（' + Math.round(bytes.length / 1024) + 'KB）。' +
      Math.round(CONFIG.GUIDE_IMAGE_MAX_BYTES / 1024 / 1024) + 'MB 以下にしてください。');
  }
  return 'data:' + mimeType + ';base64,' + Utilities.base64Encode(bytes);
}

/**
 * ファイル ID または共有 URL から、ドライブのファイル ID だけを取り出します。
 *   例）https://drive.google.com/file/d/【ID】/view?usp=sharing → 【ID】
 *       https://drive.google.com/open?id=【ID】               → 【ID】
 * @return {string} ID（取り出せなければ空文字）
 */
function extractDriveFileId_(value) {
  const text = String(value || '').trim();
  const match = text.match(/\/d\/([\w-]{20,})/) || text.match(/[?&]id=([\w-]{20,})/) || text.match(/^([\w-]{20,})$/);
  return match ? match[1] : '';
}


/* ============================================================
 * 7. シートの読み込み
 * ============================================================ */

/**
 * Settings シートを読み込み、{ キー: 値 } の形で返します。
 * 値が空・不正な場合は DEFAULT_SETTINGS の初期値を使います。
 */
function readSettings_() {
  // まず初期値を入れておく
  const settings = {};
  DEFAULT_SETTINGS.forEach(function (row) { settings[row[0]] = row[1]; });

  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEETS.SETTINGS.name);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 2).getValues().forEach(function (row) {
      const key = String(row[0]).trim();
      if (!key || row[1] === '' || row[1] === null) return;
      settings[key] = row[1];
    });
  }

  // 数値として使う設定は数値に変換（変換できなければ初期値に戻す）
  ['WARNING_SKIP_THRESHOLD', 'NORMAL_CONSIDER_THRESHOLD', 'MIN_PROGRESS_FOR_BUY', 'PRICE_MAX', 'HISTORY_LIMIT']
    .forEach(function (key) {
      const n = Number(settings[key]);
      settings[key] = (isFinite(n) && n >= 0) ? n : defaultSetting_(key);
    });

  // カテゴリーの選択肢はカンマ区切り → 配列（全角カンマ・読点も区切りとして扱う）
  const categories = String(settings.CATEGORY_OPTIONS).split(/[,、，]/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; });
  settings.CATEGORY_OPTIONS = categories.length > 0
    ? categories
    : String(defaultSetting_('CATEGORY_OPTIONS')).split(',');

  settings.APP_NAME = String(settings.APP_NAME).trim() || defaultSetting_('APP_NAME');
  settings.GUIDE_IMAGE_FILE_ID = String(settings.GUIDE_IMAGE_FILE_ID || '').trim();
  return settings;
}

/** DEFAULT_SETTINGS から 1 つの初期値を取り出します */
function defaultSetting_(key) {
  const row = DEFAULT_SETTINGS.filter(function (r) { return r[0] === key; })[0];
  return row ? row[1] : null;
}

/**
 * Checklist シートから「有効（active=TRUE）」な項目を表示順で返します。
 * 入力ミスのある行は読み飛ばし、warnings に理由を入れて返します
 * （アプリが止まらないようにするため）。
 *
 * @return {{items: Object[], warnings: string[]}}
 */
function readChecklist_() {
  const def = CONFIG.SHEETS.CHECKLIST;
  const sheet = getSpreadsheet_().getSheetByName(def.name);
  const lastRow = sheet.getLastRow();
  const items = [];
  const warnings = [];
  if (lastRow < 2) {
    return { items: items, warnings: ['Checklist にチェック項目がありません。setupSpreadsheet を実行してください。'] };
  }

  const col = indexMap_(def.headers);
  const seenIds = {};
  sheet.getRange(2, 1, lastRow - 1, def.headers.length).getValues().forEach(function (row, i) {
    const rowNo = i + 2; // シート上の行番号（エラー表示用）
    const id = String(row[col.item_id]).trim();
    if (id === '') return; // 空行は無視

    if (!isActive_(row[col.active])) return; // 無効な項目は表示しない

    const targetType = String(row[col.target_type]).trim();
    const severity = String(row[col.severity]).trim();
    const name = String(row[col.item_name]).trim();
    const category = String(row[col.category]).trim();

    if (seenIds[id]) { warnings.push(rowNo + '行目：item_id「' + id + '」が重複しているため無視しました'); return; }
    if (CONFIG.TARGET_TYPES.indexOf(targetType) === -1) { warnings.push(rowNo + '行目：target_type が不正です'); return; }
    if (CONFIG.SEVERITIES.indexOf(severity) === -1) { warnings.push(rowNo + '行目：severity が不正です'); return; }
    if (name === '' || category === '') { warnings.push(rowNo + '行目：category または item_name が空です'); return; }
    seenIds[id] = true;

    const order = Number(row[col.display_order]);
    items.push({
      id: id,
      category: category,
      name: name,
      targetType: targetType,
      severity: severity,
      order: isFinite(order) && row[col.display_order] !== '' ? order : 999999
    });
  });

  items.sort(function (a, b) { return a.order - b.order; });
  return { items: items, warnings: warnings };
}

/** active 列の値を true / false に変換します（チェックボックス・文字列のどちらにも対応） */
function isActive_(value) {
  if (value === true) return true;
  return String(value).trim().toUpperCase() === 'TRUE';
}

/** ['a','b'] → { a: 0, b: 1 } のように列名から列番号（0 始まり）を引けるようにします */
function indexMap_(headers) {
  const map = {};
  headers.forEach(function (h, i) { map[h] = i; });
  return map;
}


/* ============================================================
 * 8. 購入判定
 *    判定ルール（上から順に当てはめ、最初に当たったものが結果）
 *      1. critical の「気になる」が 1 つ以上             → 見送り
 *      2. warning の「気になる」が WARNING_SKIP_THRESHOLD 以上 → 見送り
 *      3. warning の「気になる」が 1 つ以上              → 要検討
 *      4. normal の「気になる」が NORMAL_CONSIDER_THRESHOLD 以上 → 要検討
 *      5. critical の項目に未確認が残っている            → 要検討
 *      6. 進捗率が MIN_PROGRESS_FOR_BUY 未満              → 要検討
 *      7. どれにも当たらない                              → 買い
 *    チェック数の多さではなく、問題の「重大さ」を優先しています。
 *    古着の状態・試着をそれぞれ判定し、悪い方を総合判定にします。
 * ============================================================ */

/**
 * 購入判定の本体（シートを読まない純粋な計算なので、保存時にも使い回します）。
 *
 * @param {Object} statuses  { item_id: 'ok' | 'concern' }
 * @param {Object} excluded  { 'fitting|カテゴリー名': true }
 * @param {Object[]} items   readChecklist_() の items
 * @param {Object} settings  readSettings_() の結果
 * @return {{overall: string, modes: Object, reasons: Object[]}}
 *   overall … '買い' | '要検討' | '見送り' | '未実施'
 *   modes   … { vintage: {...}, fitting: {...} } モードごとの集計と判定
 *   reasons … [{ level: 'critical'|'warning'|'normal'|'info', mode, text }] 判定理由（重い順）
 */
function judgeChecks_(statuses, excluded, items, settings) {
  const modes = {};
  let reasons = [];

  Object.keys(CONFIG.MODES).forEach(function (mode) {
    const r = judgeMode_(mode, statuses, excluded, items, settings);
    modes[mode] = r.summary;
    reasons = reasons.concat(r.reasons);
  });

  // 総合判定 = 実施したチェックのうち、いちばん悪い判定
  let worst = -1;
  Object.keys(modes).forEach(function (mode) {
    worst = Math.max(worst, CONFIG.JUDGMENTS.indexOf(modes[mode].result)); // 未実施は -1
  });

  // 理由は重い順に並べる
  const levelOrder = { critical: 0, warning: 1, normal: 2, info: 3 };
  reasons.sort(function (a, b) { return levelOrder[a.level] - levelOrder[b.level]; });

  return {
    overall: worst === -1 ? CONFIG.NOT_PERFORMED : CONFIG.JUDGMENTS[worst],
    modes: modes,
    reasons: reasons
  };
}

/** 1 種類のチェック（古着の状態 または 試着）を判定します */
function judgeMode_(mode, statuses, excluded, items, settings) {
  const def = CONFIG.MODES[mode];
  const label = def.label;
  const targets = items.filter(function (item) {
    return def.targets.indexOf(item.targetType) !== -1 && !excluded[mode + '|' + item.category];
  });

  // 集計
  const concerns = { critical: [], warning: [], normal: [] };
  const uncheckedCritical = [];
  let done = 0;
  targets.forEach(function (item) {
    const status = statuses[item.id];
    if (status === CONFIG.STATUS_OK || status === CONFIG.STATUS_CONCERN) done++;
    if (status === CONFIG.STATUS_CONCERN) concerns[item.severity].push(item.name);
    if (!status && item.severity === 'critical') uncheckedCritical.push(item.name);
  });
  const total = targets.length;
  const progress = total === 0 ? 0 : done / total;

  const summary = {
    label: label,
    result: CONFIG.NOT_PERFORMED,
    total: total,
    done: done,
    progress: progress,
    concernCount: concerns.critical.length + concerns.warning.length + concerns.normal.length,
    criticalCount: concerns.critical.length,
    warningCount: concerns.warning.length,
    normalCount: concerns.normal.length
  };

  // 1 つもチェックしていなければ「未実施」（判定に含めない）
  if (done === 0) {
    return { summary: summary, reasons: [] };
  }

  // 判定理由（画面に表示する）
  const reasons = [];
  concerns.critical.forEach(function (name) {
    reasons.push({ level: 'critical', mode: mode, text: '【' + label + '】重大：' + name });
  });
  concerns.warning.forEach(function (name) {
    reasons.push({ level: 'warning', mode: mode, text: '【' + label + '】注意：' + name });
  });
  concerns.normal.forEach(function (name) {
    reasons.push({ level: 'normal', mode: mode, text: '【' + label + '】軽微：' + name });
  });
  if (uncheckedCritical.length > 0) {
    reasons.push({
      level: 'info', mode: mode,
      text: '【' + label + '】重要な項目が未確認です：' + uncheckedCritical.join('／')
    });
  }
  if (progress < settings.MIN_PROGRESS_FOR_BUY) {
    reasons.push({
      level: 'info', mode: mode,
      text: '【' + label + '】確認できた項目が ' + Math.round(progress * 100) + '%（' + done + ' / ' + total +
        '）です。「買い」には ' + Math.round(settings.MIN_PROGRESS_FOR_BUY * 100) + '% 以上の確認が必要です'
    });
  }

  // 判定ルールを上から順に当てはめる
  let result;
  if (concerns.critical.length >= 1) {
    result = '見送り';
  } else if (concerns.warning.length >= settings.WARNING_SKIP_THRESHOLD) {
    result = '見送り';
  } else if (concerns.warning.length >= 1) {
    result = '要検討';
  } else if (concerns.normal.length >= settings.NORMAL_CONSIDER_THRESHOLD) {
    result = '要検討';
  } else if (uncheckedCritical.length > 0) {
    result = '要検討';
  } else if (progress < settings.MIN_PROGRESS_FOR_BUY) {
    result = '要検討';
  } else {
    result = '買い';
  }
  summary.result = result;

  return { summary: summary, reasons: reasons };
}

/**
 * 画面から送られたチェック結果の形を確認し、安全な形に整えます。
 * 想定外の値は使わずに捨てます（画面側の不具合や改ざんへの備え）。
 * @return {{statuses: Object, excluded: Object}}
 */
function validateCheckPayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('チェック結果が受け取れませんでした。画面を再読み込みしてください。');
  }
  const statuses = {};
  const rawStatuses = payload.statuses && typeof payload.statuses === 'object' ? payload.statuses : {};
  Object.keys(rawStatuses).slice(0, 1000).forEach(function (id) {
    const value = rawStatuses[id];
    if (id.length <= 50 && (value === CONFIG.STATUS_OK || value === CONFIG.STATUS_CONCERN)) {
      statuses[id] = value;
    }
  });

  const excluded = {};
  (Array.isArray(payload.excluded) ? payload.excluded : []).slice(0, 200).forEach(function (key) {
    if (typeof key === 'string' && key.length <= 200) excluded[key] = true;
  });
  return { statuses: statuses, excluded: excluded };
}

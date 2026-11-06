/**
 * CLOSET CHECK サーバー処理（Code.gs）の自動テスト
 *
 *   使い方（Node.js が必要）：
 *     node closet-check/tests/run.js
 *
 *   Google のサービス（SpreadsheetApp・DriveApp など）は gasmock.js の「まね」で置き換えて、
 *   Code.gs をパソコン上で動かします。Code.gs を修正したら、貼り付ける前にこれを実行してください。
 */
const { execFileSync } = require('child_process');
const path = require('path');

const codePath = path.join(__dirname, '..', 'src', 'Code.gs');
const tests = [
  ['test_step2.js', '初期化（シート作成・初期データ・再実行の安全性）'],
  ['test_judge.js', '購入判定ルール'],
  ['test_save.js', '保存（検証・二重保存防止・数式対策）'],
  ['test_history_server.js', '購入履歴の読み込み'],
  ['test_guide_server.js', 'NG例の見本画像'],
  ['test_closet_server.js', 'マイクローゼット・配色パターン']
];

let failed = 0;
tests.forEach(function (t) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, t[0]), codePath], { cwd: __dirname, stdio: 'pipe' });
    console.log('OK   ' + t[1]);
  } catch (e) {
    failed++;
    console.log('NG   ' + t[1]);
    console.log(String(e.stdout || '') + String(e.stderr || ''));
  }
});
console.log(failed === 0 ? '\nすべてのテストに合格しました' : '\n' + failed + ' 件のテストが失敗しました');
process.exit(failed === 0 ? 0 : 1);

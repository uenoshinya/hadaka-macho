export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  description: string;
  youtubeUrl: string; // 解説動画URL
}

export interface DayWorkout {
  dayIndex: number; // 0=日〜6=土
  dayName: string;
  part: string;
  emoji: string;
  isRest: boolean;
  exercises: Exercise[];
}

const yt = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " やり方 自重")}`;

export const weeklyWorkout: DayWorkout[] = [
  {
    dayIndex: 0, dayName: "日曜日", part: "休息", emoji: "😴", isRest: true,
    exercises: [
      { name: "全身ストレッチ", sets: 1, reps: "10分", description: "肩・胸・股関節をゆっくり伸ばす", youtubeUrl: yt("全身ストレッチ 10分") },
      { name: "深呼吸・リカバリー", sets: 1, reps: "5分", description: "明日への準備。しっかり休もう", youtubeUrl: yt("呼吸法 リラックス") },
    ],
  },
  {
    dayIndex: 1, dayName: "月曜日", part: "胸", emoji: "💪", isRest: false,
    exercises: [
      { name: "ノーマルプッシュアップ", sets: 3, reps: "15回", description: "プッシュアップバー使用。肩幅に手を置く", youtubeUrl: yt("腕立て伏せ 正しいフォーム") },
      { name: "ワイドプッシュアップ", sets: 3, reps: "12回", description: "手を肩幅より広く。大胸筋外側に効く", youtubeUrl: yt("ワイドプッシュアップ フォーム") },
      { name: "ダイヤモンドプッシュアップ", sets: 3, reps: "10回", description: "両手で菱形を作る。内側の胸＋三頭筋", youtubeUrl: yt("ダイヤモンドプッシュアップ フォーム") },
      { name: "デクラインプッシュアップ", sets: 3, reps: "12回", description: "足を台に乗せる。上部胸筋を鍛える", youtubeUrl: yt("デクラインプッシュアップ フォーム") },
      { name: "インクラインプッシュアップ", sets: 2, reps: "15回", description: "手を台に乗せる。下部胸筋をしっかり伸ばす", youtubeUrl: yt("インクラインプッシュアップ フォーム") },
    ],
  },
  {
    dayIndex: 2, dayName: "火曜日", part: "背中", emoji: "🏋️", isRest: false,
    exercises: [
      { name: "懸垂（ノーマルグリップ）", sets: 3, reps: "最大回数", description: "肩幅で握る。背中全体を使って引く", youtubeUrl: yt("懸垂 正しいフォーム") },
      { name: "ワイドグリップ懸垂", sets: 3, reps: "最大回数", description: "広背筋の広がりを意識", youtubeUrl: yt("ワイドグリップ懸垂 フォーム") },
      { name: "インバーテッドロウ", sets: 3, reps: "12回", description: "懸垂バーを低く設定。仰向けで引く", youtubeUrl: yt("インバーテッドロウ やり方") },
      { name: "チンアップ（逆手）", sets: 3, reps: "最大回数", description: "手のひらを手前に向ける。上腕二頭筋も使う", youtubeUrl: yt("チンアップ 逆手 フォーム") },
    ],
  },
  {
    dayIndex: 3, dayName: "水曜日", part: "脚・体幹", emoji: "🦵", isRest: false,
    exercises: [
      { name: "スクワット", sets: 4, reps: "20回", description: "膝がつま先を超えないように。深く沈む", youtubeUrl: yt("スクワット 正しいフォーム 自重") },
      { name: "ランジ", sets: 3, reps: "各12回", description: "左右交互。膝を90度に曲げる", youtubeUrl: yt("ランジ 正しいフォーム") },
      { name: "プランク", sets: 3, reps: "60秒", description: "体を一直線に。お腹をへこませて保持", youtubeUrl: yt("プランク 正しいフォーム 体幹") },
      { name: "レッグレイズ", sets: 3, reps: "15回", description: "床に仰向け。足をゆっくり上げ下げ", youtubeUrl: yt("レッグレイズ やり方 腹筋") },
      { name: "マウンテンクライマー", sets: 3, reps: "30秒", description: "プランク姿勢から膝を交互に引く", youtubeUrl: yt("マウンテンクライマー フォーム") },
    ],
  },
  {
    dayIndex: 4, dayName: "木曜日", part: "肩・腕", emoji: "💪", isRest: false,
    exercises: [
      { name: "パイクプッシュアップ", sets: 3, reps: "12回", description: "お尻を高く上げて逆V字。肩に効く", youtubeUrl: yt("パイクプッシュアップ フォーム") },
      { name: "ディップス", sets: 3, reps: "10回", description: "椅子を使って。三頭筋と胸下部", youtubeUrl: yt("ディップス 椅子 やり方") },
      { name: "クローズグリッププッシュアップ", sets: 3, reps: "12回", description: "手を近づける。三頭筋メイン", youtubeUrl: yt("ナロープッシュアップ 三頭筋 フォーム") },
      { name: "ヒンズープッシュアップ", sets: 3, reps: "10回", description: "弧を描くように。肩・胸・背中を連動", youtubeUrl: yt("ヒンズープッシュアップ やり方") },
    ],
  },
  {
    dayIndex: 5, dayName: "金曜日", part: "胸（強化）", emoji: "🔥", isRest: false,
    exercises: [
      { name: "プッシュアップバー深め", sets: 3, reps: "12回", description: "バーを使って深く沈む。可動域を最大に", youtubeUrl: yt("プッシュアップバー 使い方 効果") },
      { name: "アーチャープッシュアップ", sets: 3, reps: "各8回", description: "片側に体重を寄せる。片腕に近い負荷", youtubeUrl: yt("アーチャープッシュアップ やり方") },
      { name: "爆発的プッシュアップ", sets: 3, reps: "8回", description: "一気に押し上げる。パワー強化", youtubeUrl: yt("爆発的腕立て伏せ クラップ プッシュアップ") },
      { name: "プッシュアップ（スロー）", sets: 3, reps: "8回", description: "下ろす時4秒・上げる時2秒。筋肥大に最適", youtubeUrl: yt("スロートレーニング 腕立て 筋肥大") },
    ],
  },
  {
    dayIndex: 6, dayName: "土曜日", part: "背中（強化）", emoji: "🔥", isRest: false,
    exercises: [
      { name: "懸垂（最大回数）", sets: 3, reps: "最大回数", description: "今週の限界に挑戦", youtubeUrl: yt("懸垂 回数増やす コツ") },
      { name: "ネガティブ懸垂", sets: 3, reps: "5回", description: "下ろす動作を5秒かけてゆっくり。強度が高い", youtubeUrl: yt("ネガティブ懸垂 やり方") },
      { name: "L字懸垂", sets: 3, reps: "30秒", description: "足を前に伸ばして保持。体幹も同時に鍛える", youtubeUrl: yt("L字懸垂 やり方") },
      { name: "タオルロウ", sets: 3, reps: "12回", description: "懸垂バーにタオルを巻いて引く。握力も強化", youtubeUrl: yt("タオル 懸垂 やり方") },
    ],
  },
];

export function getTodayWorkout(): DayWorkout {
  const today = new Date().getDay();
  return weeklyWorkout[today];
}

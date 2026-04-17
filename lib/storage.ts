// ===== 型定義 =====

export interface WorkoutRecord {
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedExercises: string[]; // 全セット完了した種目名
  exerciseSets: Record<string, boolean[]>; // 種目名 → セットごとの達成フラグ
  note: string;
}

export interface MealEntry {
  content: string;      // 料理名・メモ
  calories: number;     // kcal
  isEatingOut: boolean; // 外食かどうか
}

export interface MealRecord {
  date: string;
  breakfast: MealEntry;
  lunch: MealEntry;
  dinner: MealEntry;
  note: string;
}

export interface WeightRecord {
  date: string;
  weight: number;
  bodyFat: number | null;
}

// ===== 日付ユーティリティ（JST基準） =====
// UTC+9（日本標準時）で日付文字列を返す。0時ちょうどに新しい日付に切り替わる。
export function toDateString(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

export function getWeekDates(): string[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    return toDateString(d);
  }).reverse();
}

// ===== 筋トレ記録 =====
export function getWorkoutRecord(date: string): WorkoutRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(`hadaka_workout_${date}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function saveWorkoutRecord(record: WorkoutRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`hadaka_workout_${record.date}`, JSON.stringify(record));
}

// ===== 食事記録 =====
export function getMealRecord(date: string): MealRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(`hadaka_meal_${date}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function saveMealRecord(record: MealRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`hadaka_meal_${record.date}`, JSON.stringify(record));
}

// ===== 体重記録 =====
export function getWeightRecords(): WeightRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem("hadaka_weights");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveWeightRecord(record: WeightRecord): void {
  if (typeof window === "undefined") return;
  const records = getWeightRecords();
  const existing = records.findIndex((r) => r.date === record.date);
  if (existing >= 0) records[existing] = record;
  else records.push(record);
  records.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("hadaka_weights", JSON.stringify(records));
}

export function getLatestWeight(): WeightRecord | null {
  const records = getWeightRecords();
  return records.length > 0 ? records[records.length - 1] : null;
}

// ===== Notion同期用データエクスポート =====
export function exportAllDataForNotion(): {
  workouts: WorkoutRecord[];
  meals: MealRecord[];
  weights: WeightRecord[];
} {
  if (typeof window === "undefined") return { workouts: [], meals: [], weights: [] };

  // 直近7日の筋トレ・食事
  const workouts: WorkoutRecord[] = [];
  const meals: MealRecord[] = [];
  const weekDates = getWeekDates();
  for (const date of weekDates) {
    const w = getWorkoutRecord(date);
    if (w) workouts.push(w);
    const m = getMealRecord(date);
    if (m) meals.push(m);
  }

  // 直近30日の体重
  const allWeights = getWeightRecords();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = toDateString(cutoff);
  const weights = allWeights.filter((w) => w.date >= cutoffStr);

  return { workouts, meals, weights };
}

// ===== リマインド通知 =====
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function scheduleReminder(): void {
  if (typeof window === "undefined") return;
  // 毎日17:30に通知をセット（次の17:30まで）
  const now = new Date();
  const target = new Date();
  target.setHours(17, 30, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  const msUntil = target.getTime() - now.getTime();
  setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification("🦁 裸マッチョ リマインド", {
        body: "今日の筋トレ＆食事記録を忘れずに！",
        icon: "/icon.png",
      });
    }
    scheduleReminder(); // 翌日もセット
  }, msUntil);
}

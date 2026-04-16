// ===== 型定義 =====

export interface WorkoutRecord {
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedExercises: string[];
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

// ===== 日付ユーティリティ =====
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function getWeekDates(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
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

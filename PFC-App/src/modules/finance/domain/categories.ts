/** Default categories, same set as PFC Quỹ (Flutter category_service.dart). */
export type TxType = "income" | "expense";

export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; icon: CategoryIcon; type: TxType }> = [
  { name: "Ăn uống", icon: "utensils", type: "expense" },
  { name: "Di chuyển", icon: "car", type: "expense" },
  { name: "Mua sắm", icon: "shopping-bag", type: "expense" },
  { name: "Nhà cửa", icon: "home", type: "expense" },
  { name: "Y tế", icon: "heart-pulse", type: "expense" },
  { name: "Giáo dục", icon: "graduation-cap", type: "expense" },
  { name: "Giải trí", icon: "gamepad", type: "expense" },
  { name: "Hóa đơn", icon: "zap", type: "expense" },
  { name: "Lương", icon: "wallet", type: "income" },
  { name: "Thưởng", icon: "gift", type: "income" },
  { name: "Đầu tư", icon: "trending-up", type: "income" },
  { name: "Khác", icon: "more", type: "income" },
];

/** Icons a member can pick for a custom category. Rendered by ui/CategoryIcon. */
export const CATEGORY_ICONS = [
  "utensils",
  "coffee",
  "car",
  "shopping-bag",
  "home",
  "heart-pulse",
  "graduation-cap",
  "gamepad",
  "zap",
  "plane",
  "shirt",
  "smartphone",
  "baby",
  "dumbbell",
  "wallet",
  "gift",
  "trending-up",
  "briefcase",
  "piggy-bank",
  "more",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export function isCategoryIcon(v: unknown): v is CategoryIcon {
  return typeof v === "string" && (CATEGORY_ICONS as readonly string[]).includes(v);
}

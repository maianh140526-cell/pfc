import {
  Baby,
  Briefcase,
  Car,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  MoreHorizontal,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIcon as IconName, TxType } from "../domain/categories";
import { cx } from "@/ui/cx";

const ICONS: Record<IconName, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  car: Car,
  "shopping-bag": ShoppingBag,
  home: Home,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  gamepad: Gamepad2,
  zap: Zap,
  plane: Plane,
  shirt: Shirt,
  smartphone: Smartphone,
  baby: Baby,
  dumbbell: Dumbbell,
  wallet: Wallet,
  gift: Gift,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  "piggy-bank": PiggyBank,
  more: MoreHorizontal,
};

export function CategoryGlyph({ icon, size = 20 }: { icon: IconName; size?: number }) {
  const Icon = ICONS[icon] ?? MoreHorizontal;
  return <Icon size={size} />;
}

/** Round category badge used in lists (mockup 21/24). Income green, expense red tint. */
export function CategoryBadge({ icon, type, size = "md" }: { icon: IconName; type: TxType; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-9", md: "size-11", lg: "size-16" }[size];
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-2xl",
        box,
        type === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
      )}
    >
      <CategoryGlyph icon={icon} size={size === "lg" ? 30 : size === "sm" ? 17 : 21} />
    </span>
  );
}

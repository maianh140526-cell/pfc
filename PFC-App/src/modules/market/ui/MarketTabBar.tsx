"use client";

import { Menu, ReceiptText, ShoppingCart, Store, Compass } from "lucide-react";
import { HubTabBar, type HubTab } from "@/ui/HubTabBar";

const TABS: readonly HubTab[] = [
  { href: "/market", label: "Khám phá", icon: Compass, exact: true, match: ["/market/p", "/market/shop"] },
  { href: "/market/cart", label: "Giỏ hàng", icon: ShoppingCart, match: ["/market/checkout"] },
  { href: "/market/orders", label: "Đơn mua", icon: ReceiptText },
  { href: "/market/sell", label: "Bán hàng", icon: Store },
  { href: "/market/more", label: "Thêm", icon: Menu, match: ["/market/favorites", "/market/manage"] },
];

export function MarketTabBar() {
  return <HubTabBar tabs={TABS} label="Điều hướng Marketplace" />;
}

import { Calculator, Landmark, Percent, Sunset, TrendingUp } from "lucide-react";

export const TOOLS = [
  { slug: "compound", title: "Tính lãi kép", description: "Giá trị khoản đầu tư theo thời gian", icon: TrendingUp },
  { slug: "loan", title: "Tính khoản vay", description: "Trả góp hàng tháng và lịch trả nợ", icon: Landmark },
  { slug: "retirement", title: "Kế hoạch hưu trí", description: "Cần bao nhiêu để nghỉ hưu", icon: Sunset },
  { slug: "tax", title: "Thuế thu nhập cá nhân", description: "Ước tính thuế TNCN hàng tháng", icon: Calculator },
  { slug: "rates", title: "So sánh lãi suất", description: "Lãi tiền gửi các ngân hàng", icon: Percent },
] as const;

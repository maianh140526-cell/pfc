"use client";

import { BookOpen, Briefcase, Check, Rocket, ShoppingBag, Users, Wallet, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { INTERESTS, type Interest } from "@/platform/account/options";
import { completeOnboardingAction } from "@/platform/account/actions";
import { Button } from "@/ui";
import { FormError } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

const SLIDES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Wallet, title: "Bắt đầu hành trình tài chính", text: "Ghi thu chi, lập ngân sách và theo dõi mục tiêu tiết kiệm — chỉ mình bạn xem được." },
  { icon: BookOpen, title: "Khám phá thế giới kiến thức", text: "Khóa học, bài kiểm tra và tài liệu do cộng đồng PFC biên soạn và duyệt." },
  { icon: Users, title: "Cùng nhau phát triển", text: "Tham gia câu lạc bộ, làm dự án thật, tìm cơ hội thực tập và việc làm." },
];

const ICON: Record<Interest, LucideIcon> = { finance: Wallet, learn: BookOpen, opportunities: Briefcase, community: Users, projects: Rocket, shop: ShoppingBag };

export function Onboarding({ name }: { name: string }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Interest[]>([]);
  const a = useAction();
  const finish = (list: Interest[]) => a.run(() => completeOnboardingAction(list));
  const intro = step < SLIDES.length;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
      <div className="flex justify-end">
        <button type="button" className="min-h-11 px-2 text-[14px] font-semibold text-muted" disabled={a.pending} onClick={() => finish([])}>
          Bỏ qua
        </button>
      </div>

      {intro ? (
        <div className="flex flex-1 flex-col items-center text-center">
          {(() => {
            const S = SLIDES[step];
            return (
              <>
                <span className="mt-10 grid size-28 place-items-center rounded-[32px] bg-primary-soft text-primary">
                  <S.icon size={52} strokeWidth={1.6} />
                </span>
                <h1 className="mt-8 text-[24px] leading-tight font-extrabold text-ink">{step === 0 ? `Chào ${name}! ` : ""}{S.title}</h1>
                <p className="mt-3 text-[15px] text-ink-2">{S.text}</p>
              </>
            );
          })()}
          <div className="mt-auto w-full pt-8">
            <Dots n={SLIDES.length + 1} active={step} />
            <Button block className="mt-5" onClick={() => setStep((s) => s + 1)}>
              Tiếp tục
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <h1 className="text-[24px] font-extrabold text-ink">Bắt đầu nào</h1>
          <p className="mt-1 text-[15px] text-muted">Bạn quan tâm điều gì? PFC sẽ đưa các nhánh đó lên đầu Trang chủ.</p>
          <ul className="mt-5 space-y-3">
            {(Object.keys(INTERESTS) as Interest[]).map((k) => {
              const on = picked.includes(k);
              const Icon = ICON[k];
              return (
                <li key={k}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
                    className={cx("pressable flex w-full items-center gap-3 rounded-[var(--radius-card)] border p-3.5 text-left", on ? "border-primary bg-primary-soft" : "border-line bg-surface")}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface text-primary">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{INTERESTS[k].label}</span>
                      <span className="block text-[12px] text-muted">{INTERESTS[k].description}</span>
                    </span>
                    <span className={cx("grid size-6 shrink-0 place-items-center rounded-md border-2", on ? "border-primary bg-primary text-on-primary" : "border-line")}>
                      {on && <Check size={14} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <FormError message={a.error} />
          <div className="mt-auto pt-6">
            <Dots n={SLIDES.length + 1} active={SLIDES.length} />
            <Button block className="mt-5" disabled={a.pending} onClick={() => finish(picked)}>
              {a.pending ? "Đang lưu…" : "Vào PFC"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dots({ n, active }: { n: number; active: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={cx("h-1.5 rounded-full transition-all", i === active ? "w-6 bg-primary" : "w-3 bg-line")} />
      ))}
    </div>
  );
}

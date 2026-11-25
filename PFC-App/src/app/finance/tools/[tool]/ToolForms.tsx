"use client";

import { useMemo, useState } from "react";
import { formatVnd } from "@/lib/money";
import {
  BANK_RATES,
  BANK_RATES_AS_OF,
  PIT_DEPENDENT_DEDUCTION,
  PIT_PERSONAL_DEDUCTION,
  compoundTable,
  depositInterest,
  loanSchedule,
  personalIncomeTax,
  requiredMonthly,
  requiredReturn,
  retirementTarget,
} from "@/modules/finance/domain/tools";
import { AmountInput, Card, SegmentedTabs } from "@/ui";
import { TextInput } from "@/ui/Form";
import { BarChart } from "@/ui/charts";

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));
const pct = (v: number) => `${v.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
const vnd = (v: number) => formatVnd(Math.round(v));

function Result({ rows }: { rows: Array<[string, string, boolean?]> }) {
  return (
    <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
      {rows.map(([k, v, strong]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="text-[14px] text-muted">{k}</dt>
          <dd className={strong ? "text-[17px] font-extrabold text-primary" : "text-[15px] font-semibold text-ink"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const wrap = "space-y-4 px-4 pt-2";

export function CompoundTool() {
  const [principal, setPrincipal] = useState("10000000");
  const [monthly, setMonthly] = useState("1000000");
  const [rate, setRate] = useState("7");
  const [years, setYears] = useState("10");
  const r = num(rate);
  const y = Math.floor(num(years));
  const valid = r >= 0 && r <= 100 && y >= 1 && y <= 60;
  const table = useMemo(() => (valid ? compoundTable(Number(principal || 0), r, y, Number(monthly || 0)) : []), [valid, principal, r, y, monthly]);
  const last = table.at(-1);
  return (
    <div className={wrap}>
      <AmountInput label="Số tiền ban đầu" value={principal} onChange={setPrincipal} />
      <AmountInput label="Góp thêm mỗi tháng" value={monthly} onChange={setMonthly} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Lãi suất (%/năm)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        <TextInput label="Số năm" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
      </div>
      {!valid ? (
        <p className="text-[14px] text-expense">Lãi suất 0–100%, số năm 1–60.</p>
      ) : (
        last && (
          <>
            <Result
              rows={[
                ["Giá trị sau " + y + " năm", vnd(last.value), true],
                ["Tổng tiền góp", vnd(last.contributed)],
                ["Tiền lãi", vnd(last.interest)],
              ]}
            />
            <Card>
              <BarChart tone="primary" label="Giá trị theo năm" data={table.map((t) => ({ key: String(t.year), label: `N${t.year}`, value: t.value }))} />
            </Card>
          </>
        )
      )}
    </div>
  );
}

export function LoanTool() {
  const [principal, setPrincipal] = useState("100000000");
  const [rate, setRate] = useState("10");
  const [months, setMonths] = useState("24");
  const [showAll, setShowAll] = useState(false);
  const r = num(rate);
  const m = Math.floor(num(months));
  const p = Number(principal || 0);
  const valid = p > 0 && r >= 0 && r <= 100 && m >= 1 && m <= 480;
  const s = useMemo(() => (valid ? loanSchedule(p, r, m) : null), [valid, p, r, m]);
  return (
    <div className={wrap}>
      <AmountInput label="Số tiền vay" value={principal} onChange={setPrincipal} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Lãi suất (%/năm)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        <TextInput label="Kỳ hạn (tháng)" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
      </div>
      {!s ? (
        <p className="text-[14px] text-expense">Nhập số tiền vay, lãi suất 0–100% và kỳ hạn 1–480 tháng.</p>
      ) : (
        <>
          <Result
            rows={[
              ["Trả mỗi tháng", vnd(s.payment), true],
              ["Tổng tiền lãi", vnd(s.totalInterest)],
              ["Tổng phải trả", vnd(s.totalPaid)],
            ]}
          />
          <Card className="p-0">
            <table className="w-full text-[13px]">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-left font-semibold">Kỳ</th>
                  <th className="px-3 py-2 text-right font-semibold">Gốc</th>
                  <th className="px-3 py-2 text-right font-semibold">Lãi</th>
                  <th className="px-3 py-2 text-right font-semibold">Dư nợ</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? s.rows : s.rows.slice(0, 12)).map((row) => (
                  <tr key={row.month} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-2">{row.month}</td>
                    <td className="px-3 py-2 text-right text-ink">{vnd(row.principal)}</td>
                    <td className="px-3 py-2 text-right text-ink">{vnd(row.interest)}</td>
                    <td className="px-3 py-2 text-right text-ink">{vnd(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.rows.length > 12 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full py-3 text-[14px] font-semibold text-primary">
                {showAll ? "Thu gọn" : `Xem đủ ${s.rows.length} kỳ`}
              </button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export function RetirementTool() {
  const [age, setAge] = useState("22");
  const [retireAge, setRetireAge] = useState("60");
  const [budget, setBudget] = useState("15000000");
  const [savings, setSavings] = useState("20000000");
  const [monthly, setMonthly] = useState("3000000");
  const [inflation, setInflation] = useState("4");
  const a = Math.floor(num(age));
  const ra = Math.floor(num(retireAge));
  const inf = num(inflation);
  const years = ra - a;
  const valid = a >= 15 && a < ra && ra <= 80 && inf >= 0 && inf <= 30 && Number(budget) > 0;
  const result = useMemo(() => {
    if (!valid) return null;
    const target = retirementTarget(Number(budget), inf, years);
    const need = requiredReturn(target, Number(savings || 0), Number(monthly || 0), years);
    const at8 = requiredMonthly(target, Number(savings || 0), 8, years);
    return { target, need, at8 };
  }, [valid, budget, inf, years, savings, monthly]);
  return (
    <div className={wrap}>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Tuổi hiện tại" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        <TextInput label="Tuổi nghỉ hưu" inputMode="numeric" value={retireAge} onChange={(e) => setRetireAge(e.target.value)} />
      </div>
      <AmountInput label="Chi tiêu mỗi tháng khi nghỉ hưu (theo giá hôm nay)" value={budget} onChange={setBudget} />
      <AmountInput label="Tiết kiệm hiện có" value={savings} onChange={setSavings} />
      <AmountInput label="Góp thêm mỗi tháng" value={monthly} onChange={setMonthly} />
      <TextInput label="Lạm phát giả định (%/năm)" inputMode="decimal" value={inflation} onChange={(e) => setInflation(e.target.value)} />
      {!result ? (
        <p className="text-[14px] text-expense">Kiểm tra tuổi (15–80, tuổi nghỉ hưu lớn hơn hiện tại), chi tiêu và lạm phát 0–30%.</p>
      ) : (
        <>
          <Result
            rows={[
              ["Số tiền cần khi nghỉ hưu", vnd(result.target), true],
              ["Số năm tích lũy", `${years} năm`],
              ["Lợi nhuận cần đạt", result.need === Infinity ? "> 50%/năm" : `${pct(result.need)}/năm`],
              ["Cần góp/tháng nếu lãi 8%", vnd(result.at8)],
            ]}
          />
          <Card className="text-[13px] leading-relaxed text-ink-2">
            {result.need <= 15
              ? "Mức lợi nhuận cần đạt nằm trong vùng an toàn (≤ 15%/năm)."
              : result.need <= 20
                ? "Mức lợi nhuận cần đạt khá cao (15–20%/năm). Cân nhắc tăng tiền góp hoặc nghỉ hưu muộn hơn."
                : "Mức lợi nhuận cần đạt rất rủi ro (> 20%/năm). Nên tăng tiền góp, giảm chi tiêu dự kiến hoặc lùi tuổi nghỉ hưu."}
            <br />
            Mục tiêu tính theo quy tắc 25 lần chi tiêu năm (rút 4%/năm), đã điều chỉnh lạm phát.
          </Card>
        </>
      )}
    </div>
  );
}

export function TaxTool() {
  const [income, setIncome] = useState("25000000");
  const [dependents, setDependents] = useState("0");
  const [insurance, setInsurance] = useState("2625000");
  const d = Math.floor(num(dependents));
  const inc = Number(income || 0);
  const ins = Number(insurance || 0);
  const valid = inc > 0 && d >= 0 && d <= 20 && ins <= inc;
  const r = useMemo(() => (valid ? personalIncomeTax(inc, d, ins) : null), [valid, inc, d, ins]);
  return (
    <div className={wrap}>
      <AmountInput label="Thu nhập chịu thuế mỗi tháng (gross)" value={income} onChange={setIncome} />
      <AmountInput label="Bảo hiểm bắt buộc phải đóng" value={insurance} onChange={setInsurance} />
      <TextInput label="Số người phụ thuộc" inputMode="numeric" value={dependents} onChange={(e) => setDependents(e.target.value)} />
      <p className="text-[12px] text-muted">
        Giảm trừ bản thân {vnd(PIT_PERSONAL_DEDUCTION)}, mỗi người phụ thuộc {vnd(PIT_DEPENDENT_DEDUCTION)} (theo PFC Quỹ).
      </p>
      {!r ? (
        <p className="text-[14px] text-expense">Nhập thu nhập lớn hơn 0; bảo hiểm không lớn hơn thu nhập.</p>
      ) : (
        <>
          <Result
            rows={[
              ["Thuế TNCN phải nộp", vnd(r.tax), true],
              ["Thu nhập tính thuế", vnd(r.taxable)],
              ["Thực nhận (net)", vnd(r.net)],
            ]}
          />
          {r.details.length > 0 && (
            <Card className="p-0">
              <table className="w-full text-[13px]">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 text-left font-semibold">Bậc</th>
                    <th className="px-3 py-2 text-right font-semibold">Thuế suất</th>
                    <th className="px-3 py-2 text-right font-semibold">Thuế</th>
                  </tr>
                </thead>
                <tbody>
                  {r.details.map((x) => (
                    <tr key={x.label} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-ink-2">{x.label}</td>
                      <td className="px-3 py-2 text-right text-ink">{x.rate * 100}%</td>
                      <td className="px-3 py-2 text-right text-ink">{vnd(x.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export function RatesTool() {
  const [term, setTerm] = useState<"m3" | "m6" | "m12">("m12");
  const [amount, setAmount] = useState("100000000");
  const months = { m3: 3, m6: 6, m12: 12 }[term];
  const sorted = [...BANK_RATES].sort((a, b) => b[term] - a[term]);
  return (
    <div className={wrap}>
      <SegmentedTabs
        label="Kỳ hạn"
        stretch
        value={term}
        onChange={setTerm}
        options={[
          { value: "m3", label: "3 tháng" },
          { value: "m6", label: "6 tháng" },
          { value: "m12", label: "12 tháng" },
        ]}
      />
      <AmountInput label="Số tiền gửi" value={amount} onChange={setAmount} />
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {sorted.map((b, i) => (
          <li key={b.bank} className="flex items-center gap-3 px-4 py-3">
            <span className="w-5 text-[13px] font-bold text-muted">{i + 1}</span>
            <span className="flex-1 text-[15px] font-semibold text-ink">{b.bank}</span>
            <span className="text-right">
              <span className="block text-[15px] font-bold text-primary">{pct(b[term])}</span>
              <span className="block text-[12px] text-muted">+{vnd(depositInterest(Number(amount || 0), b[term], months))}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-muted">
        Dữ liệu tĩnh tham khảo tháng {BANK_RATES_AS_OF} từ PFC Quỹ, không phải lãi suất thời gian thực. Kiểm tra lại với ngân hàng trước khi gửi.
      </p>
    </div>
  );
}

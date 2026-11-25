"use client";

import { CheckCircle2, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { importCsvAction, type ImportSummary } from "@/modules/finance/server/actions";
import { Button, Card } from "@/ui";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** Pick file → preview (dry run, nothing written) → confirm (all-or-nothing). */
export function ImportPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);
  const { run, pending, error, setError } = useAction();

  async function onFile(f: File | undefined) {
    setPreview(null);
    setDone(null);
    setError(null);
    if (!f) return;
    if (f.size > 2_000_000) return setError("Tệp quá lớn (tối đa 2 MB).");
    const t = await f.text();
    setText(t);
    setFileName(f.name);
    run(() => importCsvAction(t, true), setPreview);
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center text-center">
        <CheckCircle2 size={44} className="text-income" />
        <p className="mt-2 text-[17px] font-bold text-ink">Đã nhập {done.imported} giao dịch</p>
        {done.createdCategories.length > 0 && (
          <p className="mt-1 text-[13px] text-muted">Danh mục mới: {done.createdCategories.join(", ")}</p>
        )}
        <Button variant="secondary" className="mt-4" onClick={() => setDone(null)}>
          Nhập tệp khác
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="text-[13px] leading-relaxed text-ink-2">
        Cột bắt buộc: <code className="font-semibold">date, type, amount, category</code> (tùy chọn <code className="font-semibold">note</code>).
        <br />
        date = <code>YYYY-MM-DD</code> hoặc <code>YYYY-MM-DD HH:mm</code>, type = <code>income</code>/<code>expense</code>, amount = số
        nguyên VND. Định dạng giống tệp xuất của PFC.
      </Card>
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button variant="secondary" block onClick={() => input.current?.click()} disabled={pending}>
        <FileUp size={18} /> {fileName ? `Chọn lại (${fileName})` : "Chọn tệp CSV"}
      </Button>
      <FormError message={error} />
      {preview && (
        <Card>
          <p className="text-[15px] font-bold text-ink">Xem trước</p>
          <p className="mt-1 text-[14px] text-ink-2">
            {preview.imported} dòng hợp lệ · {preview.errors.length} dòng lỗi
          </p>
          {preview.createdCategories.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">Sẽ tạo danh mục mới: {preview.createdCategories.join(", ")}</p>
          )}
          {preview.errors.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-expense-soft p-3 text-[13px] text-expense">
              {preview.errors.slice(0, 50).map((e) => (
                <li key={e.line}>
                  Dòng {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <Button
            block
            className="mt-4"
            disabled={pending || preview.errors.length > 0 || preview.imported === 0}
            onClick={() => text && run(() => importCsvAction(text, false), setDone)}
          >
            {pending ? "Đang nhập…" : preview.errors.length > 0 ? "Sửa lỗi trong tệp rồi chọn lại" : `Nhập ${preview.imported} giao dịch`}
          </Button>
        </Card>
      )}
    </div>
  );
}

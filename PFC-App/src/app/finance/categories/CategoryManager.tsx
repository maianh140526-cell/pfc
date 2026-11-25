"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { CATEGORY_ICONS, type CategoryIcon, type TxType } from "@/modules/finance/domain/categories";
import { archiveCategoryAction, createCategoryAction, updateCategoryAction } from "@/modules/finance/server/actions";
import type { Category } from "@/modules/finance/server/queries";
import { CategoryBadge, CategoryGlyph } from "@/modules/finance/ui/CategoryIcon";
import { BottomSheet, Button, SegmentedTabs } from "@/ui";
import { FormError, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { cx } from "@/ui/cx";

type Editing = { id?: string; name: string; icon: CategoryIcon; type: TxType };

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [type, setType] = useState<TxType>("expense");
  const [editing, setEditing] = useState<Editing | null>(null);
  const save = useAction();
  const archive = useAction();
  const list = categories.filter((c) => c.type === type);

  function submit() {
    if (!editing) return;
    const close = () => setEditing(null);
    if (editing.id) save.run(() => updateCategoryAction(editing.id!, { name: editing.name, icon: editing.icon }), close);
    else save.run(() => createCategoryAction(editing), close);
  }

  return (
    <div className="space-y-4 px-4 pt-2">
      <SegmentedTabs
        label="Loại danh mục"
        stretch
        value={type}
        onChange={setType}
        options={[
          { value: "expense", label: "Chi tiêu" },
          { value: "income", label: "Thu nhập" },
        ]}
      />
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setEditing({ id: c.id, name: c.name, icon: c.icon, type: c.type })}
              className="pressable flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2"
            >
              <CategoryBadge icon={c.icon} type={c.type} size="sm" />
              <span className="flex-1 text-[15px] font-semibold text-ink">{c.name}</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" block onClick={() => setEditing({ name: "", icon: type === "expense" ? "shopping-bag" : "wallet", type })}>
        <Plus size={18} /> Thêm danh mục
      </Button>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Sửa danh mục" : "Danh mục mới"}
        footer={
          <div className="space-y-2">
            <Button block disabled={save.pending} onClick={submit}>
              {save.pending ? "Đang lưu…" : "Lưu"}
            </Button>
            {editing?.id && (
              <Button
                variant="ghost"
                block
                className="text-expense"
                disabled={archive.pending}
                onClick={() => archive.run(() => archiveCategoryAction(editing.id!), () => setEditing(null))}
              >
                Ẩn danh mục
              </Button>
            )}
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <TextInput label="Tên danh mục" value={editing.name} maxLength={40} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink-2">Biểu tượng</p>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Biểu tượng">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    role="radio"
                    aria-checked={editing.icon === icon}
                    aria-label={icon}
                    onClick={() => setEditing({ ...editing, icon })}
                    className={cx(
                      "pressable grid aspect-square place-items-center rounded-2xl border-2",
                      editing.icon === icon ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-2",
                    )}
                  >
                    <CategoryGlyph icon={icon} size={22} />
                  </button>
                ))}
              </div>
            </div>
            {editing.id && (
              <p className="text-[12px] text-muted">
                Ẩn danh mục không xóa giao dịch cũ; danh mục sẽ không còn hiện khi thêm giao dịch mới.
              </p>
            )}
            <FormError message={save.error ?? archive.error} />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

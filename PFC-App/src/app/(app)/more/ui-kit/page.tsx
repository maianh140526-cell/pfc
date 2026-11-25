"use client";

import { Bell, Inbox, Wallet } from "lucide-react";
import { useState } from "react";
import {
  AmountInput,
  AppHeader,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ListGroup,
  ListItem,
  SegmentedTabs,
  Section,
  Skeleton,
} from "@/ui";
import { formatVnd } from "@/lib/money";
import { ImageUploader } from "@/ui/ImageUploader";

/** Living gallery of the shared mobile components, for designers and module teams. */
export default function UiKitPage() {
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [amount, setAmount] = useState("125000");
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  return (
    <>
      <AppHeader back backFallback="/more" title="Bộ giao diện" />

      <Section title="Nút">
        <div className="grid gap-2">
          <Button block>Primary</Button>
          <Button block variant="secondary">
            Secondary
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Xóa</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Section>

      <Section title="Segmented tabs">
        <SegmentedTabs
          label="Ví dụ"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "a", label: "Tất cả" },
            { value: "b", label: "Thu nhập" },
            { value: "c", label: "Chi tiêu" },
          ]}
        />
      </Section>

      <Section title="Nhập số tiền">
        <AmountInput value={amount} onChange={setAmount} />
        <p className="mt-2 text-[13px] text-muted">Giá trị: {amount ? formatVnd(Number(amount)) : "—"}</p>
      </Section>

      <Section title="Thẻ & nhãn">
        <Card>
          <p className="text-[13px] text-muted">Thẻ mẫu</p>
          <p className="text-[24px] font-extrabold text-ink">{formatVnd(0)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>Primary</Badge>
            <Badge tone="income">Thu</Badge>
            <Badge tone="expense">Chi</Badge>
            <Badge tone="warning">Chờ duyệt</Badge>
            <Badge tone="muted">Nháp</Badge>
          </div>
        </Card>
      </Section>

      <Section title="Danh sách">
        <ListGroup>
          <ListItem icon={Wallet} title="Mục có liên kết" description="Mô tả ngắn" href="/more/ui-kit" />
          <ListItem icon={Bell} title="Mục bị tắt" disabled />
        </ListGroup>
      </Section>

      <Section title="Bottom sheet">
        <Button block variant="secondary" onClick={() => setOpen(true)}>
          Mở bottom sheet
        </Button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Bottom sheet mẫu" footer={<Button block onClick={() => setOpen(false)}>Xong</Button>}>
          <p className="text-[15px] text-ink-2">Thay cho modal trên điện thoại. Chạm nền tối hoặc nút ✕ để đóng.</p>
        </BottomSheet>
      </Section>

      <Section title="Đang tải (skeleton)">
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14 w-2/3" />
        </div>
      </Section>

      <Section title="Tải ảnh">
        <ImageUploader purpose="listing" max={3} value={photos} onChange={setPhotos} />
      </Section>

      <Section title="Trạng thái trống">
        <Card className="p-0">
          <EmptyState icon={Inbox} title="Không có dữ liệu" description="Mô tả ngắn giúp người dùng biết làm gì tiếp." />
        </Card>
      </Section>
    </>
  );
}

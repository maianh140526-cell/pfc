"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/modules/market/domain/orders";
import { CONDITION_LABEL, LISTING_TYPES, type ListingType, type SellerLevel } from "@/modules/market/domain/listings";
import { createListingAction, deleteListingAction, listingTransitionAction, updateListingAction } from "@/modules/market/server/actions";
import type { ContentStatus } from "@/platform/workflow";
import { AmountInput, Button, ButtonLink, Section } from "@/ui";
import { AttachmentPicker } from "@/ui/AttachmentPicker";
import { ImageUploader } from "@/ui/ImageUploader";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { WorkflowBar } from "@/ui/WorkflowBar";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

type V = {
  kind: ListingType;
  category: string;
  title: string;
  description: string;
  price: string;
  stock: string;
  unlimited: boolean;
  delivery: string;
  images: string[];
  tags: string[];
  courseId: string;
  eventId: string;
  itemCondition: string;
  deliveryArea: string;
  serviceScope: string;
  availability: string;
  quotation: string;
  accessInfo: string;
  fileUrl: string;
  fileName: string;
};
type Existing = { id: string; status: ContentStatus; rejectReason: string | null; canApprove: boolean } & V;
type Links = { courses: { id: string; title: string }[]; events: { id: string; title: string; startsAt: string }[] };

/** SELL-05 Create / SELL-06 Edit listing (mockup 129): type, title, category & tags, VND price, description, media. */
export function ListingEditor({ existing, links, level, limits }: { existing?: Existing; links: Links; level: SellerLevel; limits: { basicMaxPrice: number; basicMaxListings: number } }) {
  const router = useRouter();
  const [v, setV] = useState<V>(
    existing ?? { kind: "product", category: "book", title: "", description: "", price: "", stock: "1", unlimited: false, delivery: "ship", images: [], tags: [], courseId: "", eventId: "", itemCondition: "", deliveryArea: "", serviceScope: "", availability: "", quotation: "", accessInfo: "", fileUrl: "", fileName: "" },
  );
  const [tag, setTag] = useState("");
  const { run, pending, error } = useAction();
  const set = (k: keyof V) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const online = v.kind === "digital" || v.kind === "course" || v.kind === "ticket";
  const needsVerify = level === "basic" && LISTING_TYPES[v.kind].risk === "high";
  const overCap = level === "basic" && Number(v.price || 0) > limits.basicMaxPrice;
  const addTag = () => {
    const t = tag.trim().replace(/^#/, "").toLowerCase();
    if (t.length >= 2 && !v.tags.includes(t) && v.tags.length < 8) setV({ ...v, tags: [...v.tags, t] });
    setTag("");
  };
  const payload = () => ({
    kind: v.kind,
    category: v.category,
    title: v.title,
    description: v.description,
    price: v.kind === "ticket" ? 0 : Number(v.price || 0),
    currency: "VND",
    stock: v.unlimited || v.kind === "ticket" ? null : Number(v.stock || 0),
    delivery: online ? "online" : v.delivery,
    images: v.images,
    tags: v.tags,
    courseId: v.kind === "course" ? v.courseId || null : null,
    eventId: v.kind === "ticket" ? v.eventId || null : null,
    itemCondition: v.itemCondition,
    deliveryArea: v.deliveryArea,
    serviceScope: v.serviceScope,
    availability: v.availability,
    quotation: v.quotation,
    accessInfo: v.accessInfo,
    fileUrl: v.fileUrl,
    fileName: v.fileName,
  });

  return (
    <>
      {existing && (
        <Section>
          <WorkflowBar
            status={existing.status}
            isAuthor
            canApprove={existing.canApprove}
            rejectReason={existing.rejectReason}
            submitLabel="Gửi duyệt tin"
            canDelete
            onAction={async (a, r) => {
              const res = await listingTransitionAction(existing.id, a, r);
              if (res.ok) router.refresh();
              return res.ok ? { ok: true } : res;
            }}
            onDelete={async () => {
              const res = await deleteListingAction(existing.id);
              if (res.ok) router.replace("/market/sell");
              return res.ok ? { ok: true } : res;
            }}
          />
          {existing.status === "published" && <p className="mt-2 text-[12px] text-muted">Sửa tin đang bán sẽ gửi lại để duyệt.</p>}
        </Section>
      )}
      <form
        className="space-y-4 px-4 pt-4 pb-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (existing) run(() => updateListingAction(existing.id, payload()), () => router.refresh());
          else run(() => createListingAction(payload()), (id) => router.replace(`/market/sell/listings/${id}`));
        }}
      >
        <fieldset disabled={existing?.status === "submitted"} className="space-y-4">
          <div role="radiogroup" aria-label="Loại tin đăng" className="grid grid-cols-2 gap-2">
            {(Object.keys(LISTING_TYPES) as ListingType[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={v.kind === k}
                onClick={() => setV({ ...v, kind: k, unlimited: k !== "product" ? true : v.unlimited })}
                className={cx("rounded-2xl border-2 p-3 text-left", v.kind === k ? "border-primary bg-primary-soft" : "border-line bg-surface", k === "ticket" && "col-span-2")}
              >
                <span className="block text-[14px] font-bold text-ink">{LISTING_TYPES[k].label}</span>
                <span className="block text-[12px] text-muted">{LISTING_TYPES[k].hint}</span>
              </button>
            ))}
          </div>
          {needsVerify && (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-[13px] text-warning">
              {LISTING_TYPES[v.kind].label} cần cửa hàng đã xác minh.{" "}
              <a href="/market/sell#verify" className="font-semibold underline">
                Gửi yêu cầu xác minh
              </a>
            </p>
          )}

          {v.kind === "course" &&
            (links.courses.length ? (
              <SelectInput label="Khóa học liên kết" value={v.courseId} onChange={set("courseId")}>
                <option value="">— Chọn khóa học của bạn —</option>
                {links.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
                Bạn chưa có khóa học đã xuất bản trong Học tập.{" "}
                <ButtonLink href="/learn/manage/courses/new" variant="ghost">
                  Tạo khóa học
                </ButtonLink>
              </div>
            ))}
          {v.kind === "ticket" &&
            (links.events.length ? (
              <SelectInput label="Sự kiện liên kết" value={v.eventId} onChange={set("eventId")}>
                <option value="">— Chọn sự kiện bạn tổ chức —</option>
                {links.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {e.startsAt.slice(0, 10).split("-").reverse().join("/")}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
                Bạn chưa có sự kiện đang mở đăng ký.{" "}
                <ButtonLink href="/events/new" variant="ghost">
                  Tạo sự kiện
                </ButtonLink>
              </div>
            ))}

          <TextInput label="Tiêu đề" value={v.title} onChange={set("title")} maxLength={120} placeholder="Tên sản phẩm / dịch vụ rõ ràng, ngắn gọn" />
          <SelectInput label="Danh mục" value={v.category} onChange={set("category")}>
            {Object.entries(CATEGORIES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectInput>
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextInput
                  label="Tag"
                  hint="Nhấn Enter để thêm, tối đa 8"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  maxLength={24}
                  placeholder="vd: sách cũ, excel"
                />
              </div>
              <Button variant="secondary" onClick={addTag} disabled={tag.trim().length < 2} className="mb-6">
                Thêm
              </Button>
            </div>
            {v.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {v.tags.map((t) => (
                  <li key={t}>
                    <button type="button" onClick={() => setV({ ...v, tags: v.tags.filter((x) => x !== t) })} aria-label={`Bỏ tag ${t}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft px-3 text-[13px] font-semibold text-primary">
                      #{t} <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ImageUploader purpose="listing" label="Hình ảnh" hint="Ảnh chụp thật / ảnh bìa. JPG, PNG, WebP; ảnh được nén và xóa thông tin vị trí." value={v.images} onChange={(images) => setV((x) => ({ ...x, images }))} />
          <TextArea label="Mô tả chi tiết" value={v.description} onChange={set("description")} maxLength={5000} rows={5} placeholder="Công dụng, tình trạng, phạm vi hoặc quyền lợi đi kèm…" />
          {v.kind === "ticket" ? (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">Giá vé lấy từ các loại vé của sự kiện. Người mua bấm “Mua vé” và đăng ký, thanh toán tại trang sự kiện.</p>
          ) : (
            <>
              <AmountInput label="Giá bán (VND)" value={v.price} onChange={(p) => setV({ ...v, price: p })} />
              {overCap && <p className="-mt-2 text-[12px] text-warning">Cửa hàng chưa xác minh bán tối đa {limits.basicMaxPrice.toLocaleString("vi-VN")}₫ / món.</p>}
              <Toggle label="Không giới hạn số lượng" description="Dùng cho dịch vụ, sản phẩm số, khóa học" checked={v.unlimited} onChange={(b) => setV({ ...v, unlimited: b })} />
              {!v.unlimited && <TextInput label="Số lượng trong kho" type="number" inputMode="numeric" min={0} value={v.stock} onChange={set("stock")} />}
            </>
          )}
          {v.kind === "product" && (
            <SelectInput label="Tình trạng" value={v.itemCondition} onChange={set("itemCondition")}>
              <option value="">— Chọn tình trạng —</option>
              {Object.entries(CONDITION_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </SelectInput>
          )}
          {v.kind === "service" && (
            <>
              <TextArea label="Phạm vi dịch vụ" value={v.serviceScope} onChange={set("serviceScope")} maxLength={1500} rows={3} placeholder="Làm những gì, không làm gì, sản phẩm bàn giao…" />
              <TextInput label="Thời gian sẵn sàng" value={v.availability} onChange={set("availability")} maxLength={300} placeholder="vd: Tối T2–T6, cuối tuần cả ngày" />
              <TextInput label="Cách báo giá" hint="Nếu giá thay đổi theo yêu cầu" value={v.quotation} onChange={set("quotation")} maxLength={500} placeholder="vd: Báo giá theo số trang / số giờ sau khi trao đổi" />
            </>
          )}
          {v.kind === "digital" && (
            <AttachmentPicker
              label="Tệp giao cho người mua"
              max={1}
              value={v.fileUrl ? [{ url: v.fileUrl, name: v.fileName }] : []}
              onChange={(a) => setV((x) => ({ ...x, fileUrl: a[0]?.url ?? "", fileName: a[0]?.name ?? "" }))}
              hint="eBook, template, tài liệu (PDF, Word, Excel, PowerPoint…, tối đa 4 MB). Chỉ người đã thanh toán mới tải được."
            />
          )}
          {(v.kind === "digital" || v.kind === "course") && (
            <TextArea
              label={v.kind === "course" ? "Hướng dẫn thêm sau thanh toán (không bắt buộc)" : "Link / hướng dẫn truy cập"}
              value={v.accessInfo}
              onChange={set("accessInfo")}
              maxLength={2000}
              rows={3}
              placeholder={v.kind === "course" ? "vd: Tham gia nhóm Zalo của lớp tại…" : "vd: Link Google Drive, mật khẩu, cách xem online…"}
            />
          )}
          {v.kind === "product" && v.delivery !== "online" && <TextInput label="Khu vực giao / nhận hàng" value={v.deliveryArea} onChange={set("deliveryArea")} maxLength={200} placeholder="vd: Cầu Giấy, Hà Nội — nhận tại cổng trường" />}
          {online ? (
            <p className="text-[13px] text-muted">{v.kind === "ticket" ? "Vé QR được cấp tự động sau khi đăng ký." : "Giao trực tuyến (gửi link / tài liệu sau khi xác nhận đơn)."}</p>
          ) : (
            <SelectInput label="Cách giao" value={v.delivery} onChange={set("delivery")}>
              <option value="ship">Giao hàng tận nơi</option>
              <option value="pickup">Nhận trực tiếp</option>
              <option value="online">Trực tuyến</option>
            </SelectInput>
          )}
          <FormError message={error} />
          <Button type="submit" block disabled={pending}>
            {pending ? "Đang lưu…" : existing ? "Lưu thay đổi" : "Lưu bản nháp"}
          </Button>
          <p className="text-[12px] text-muted">Tin đăng được Ban Truyền thông duyệt trước khi hiện công khai. Giá tính bằng VND (số nguyên).</p>
        </fieldset>
      </form>
    </>
  );
}

"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { TIER_LABEL, type ApplyMode, type OppType, type ProviderTier } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";

/** OPP-A02 Create Opportunity (saved as Draft; verification happens after "Gửi xác minh"). */
export default function NewOpportunityPage() {
  return (
    <>
      <AppHeader back backFallback="/opportunities/provider" title="Tạo tin đăng" />
      <OppGate>{() => <Form />}</OppGate>
    </>
  );
}

function Form() {
  const router = useRouter();
  const provider = useHub<{ provider?: { displayName: string; verificationTier: ProviderTier } }>("opp", "/provider/opportunities").data?.provider;
  const [f, setF] = useState({
    type: "INTERNSHIP" as OppType,
    title: "",
    summary: "",
    description: "",
    requirements: "",
    benefits: "",
    locationText: "",
    workMode: "ONSITE",
    employmentType: "",
    deadline: "",
    applyMode: "EXTERNAL" as ApplyMode,
    externalUrl: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.applyMode !== "INTERNAL" && !/^https:\/\//.test(f.externalUrl)) return setError("Liên kết ứng tuyển phải bắt đầu bằng https://");
    setPending(true);
    try {
      await hubFetch("opp", "/provider/opportunities", {
        method: "POST",
        json: {
          type: f.type,
          title: f.title.trim(),
          summary: f.summary.trim() || undefined,
          description: f.description.trim(),
          requirements: f.requirements.trim() || undefined,
          benefits: f.benefits.trim() || undefined,
          locationText: f.locationText.trim() || undefined,
          workMode: f.workMode,
          employmentType: f.employmentType || undefined,
          deadlineAt: f.deadline ? new Date(`${f.deadline}T23:59:00+07:00`).toISOString() : null,
          applyMode: f.applyMode,
          externalUrl: f.applyMode === "INTERNAL" ? null : f.externalUrl.trim(),
        },
      });
      router.replace("/opportunities/provider");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo tin thất bại.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 pt-2" noValidate>
      {provider && (
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
          <span className="text-muted">Đơn vị đăng:</span>
          <b className="text-ink">{provider.displayName}</b>
          {TIER_LABEL[provider.verificationTier] && (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
              <BadgeCheck size={14} /> {TIER_LABEL[provider.verificationTier]}
            </span>
          )}
        </div>
      )}
      <SelectInput label="Loại cơ hội" value={f.type} onChange={set("type")}>
        <option value="INTERNSHIP">Thực tập</option>
        <option value="JOB">Việc làm</option>
        <option value="COMPETITION">Cuộc thi</option>
        <option value="SCHOLARSHIP">Học bổng</option>
      </SelectInput>
      <TextInput label="Tiêu đề" value={f.title} onChange={set("title")} maxLength={120} />
      <TextInput label="Tóm tắt (không bắt buộc)" value={f.summary} onChange={set("summary")} maxLength={200} />
      <TextArea label="Mô tả" value={f.description} onChange={set("description")} rows={5} maxLength={5000} />
      <TextArea label="Yêu cầu (không bắt buộc)" value={f.requirements} onChange={set("requirements")} maxLength={3000} />
      <TextArea label="Quyền lợi (không bắt buộc)" value={f.benefits} onChange={set("benefits")} maxLength={3000} />
      <TextInput label="Địa điểm" value={f.locationText} onChange={set("locationText")} placeholder="Hà Nội, TP.HCM, Online…" />
      <div className="grid grid-cols-2 gap-3">
        <SelectInput label="Hình thức" value={f.workMode} onChange={set("workMode")}>
          <option value="ONSITE">Tại văn phòng</option>
          <option value="REMOTE">Từ xa</option>
          <option value="HYBRID">Linh hoạt</option>
        </SelectInput>
        <SelectInput label="Loại hợp đồng" value={f.employmentType} onChange={set("employmentType")}>
          <option value="">Không áp dụng</option>
          <option value="CTV">CTV</option>
          <option value="PART_TIME">Bán thời gian</option>
          <option value="FULL_TIME">Toàn thời gian</option>
        </SelectInput>
      </div>
      <TextInput label="Hạn nộp" type="date" value={f.deadline} onChange={set("deadline")} />
      <SelectInput label="Cách ứng tuyển" value={f.applyMode} onChange={set("applyMode")}>
        <option value="EXTERNAL">Trên trang của đơn vị</option>
        <option value="INTERNAL">Trực tiếp trên PFC</option>
        <option value="BOTH">Cả hai</option>
      </SelectInput>
      {f.applyMode !== "INTERNAL" && (
        <TextInput label="Liên kết ứng tuyển (https)" type="url" inputMode="url" value={f.externalUrl} onChange={set("externalUrl")} placeholder="https://" />
      )}
      <FormError message={error} />
      <Button type="submit" block disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu bản nháp"}
      </Button>
      <p className="pb-6 text-[12px] text-muted">
        {provider?.verificationTier === "TRUSTED_PARTNER"
          ? "Đối tác tin cậy: bấm “Gửi xác minh” là tin hiện ngay, Ban điều hành hậu kiểm."
          : "Sau khi lưu, bấm “Gửi xác minh”: tin hiện công khai khi người duyệt xác minh. Hết hạn nộp, tin tự chuyển sang Hết hạn."}
      </p>
    </form>
  );
}

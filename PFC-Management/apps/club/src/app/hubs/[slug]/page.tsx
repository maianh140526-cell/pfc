"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { hubBySlug, hubOrigin } from "@/domain/hub-branches";

type HubLive = {
  live: boolean;
  ready: boolean;
  open: string;
  origin?: string;
  path?: string;
  runHint?: string;
  modulePath?: string;
};

export default function HubGatewayPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug ?? "");
  const branch = hubBySlug(slug);
  const [hub, setHub] = useState<HubLive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branch) {
      setLoading(false);
      return;
    }
    if (branch.open === "internal" && branch.internalPath) {
      router.replace(branch.internalPath);
      return;
    }
    if (branch.open === "soon" || !branch.ready) {
      setHub({ live: false, ready: false, open: "soon" });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(`/api/club?action=hub_status&slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok && j.hub) setHub(j.hub as HubLive);
        else
          setHub({
            live: false,
            ready: true,
            open: "external",
            origin: hubOrigin(branch),
            runHint: branch.runHint,
            modulePath: branch.modulePath,
          });
      })
      .catch(() => {
        if (!cancelled)
          setHub({
            live: false,
            ready: true,
            open: "external",
            origin: hubOrigin(branch),
            runHint: branch.runHint,
            modulePath: branch.modulePath,
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branch, router, slug]);

  if (!branch) {
    return (
      <div className="section hub-gate">
        <p className="error-banner">Không tìm thấy nhánh này.</p>
        <Link href="/lobby" className="btn-ghost">
          ← Phòng khách
        </Link>
      </div>
    );
  }

  if (branch.open === "internal") {
    return (
      <div className="section hub-gate">
        <p className="muted">Đang mở {branch.title}…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section hub-gate">
        <Link href="/lobby" className="hub-back-inline">
          ← Phòng khách
        </Link>
        <div className={`hub-soon-card tone-${branch.tone}`}>
          <p className="hub-spinner-line">
            <span className="login-spinner" aria-hidden />
            Đang kiểm tra module {branch.title}…
          </p>
        </div>
      </div>
    );
  }

  if (!hub?.ready || hub.open === "soon") {
    return (
      <div className="section hub-gate">
        <Link href="/lobby" className="hub-back-inline">
          ← Phòng khách
        </Link>
        <div className={`hub-soon-card tone-${branch.tone}`}>
          <span className="hub-soon-ico">{branch.icon}</span>
          <h1>
            {branch.id} · {branch.title}
          </h1>
          <p>Nhánh này chưa có module trong monorepo.</p>
          <ul className="hub-ready-list">
            <li>
              <Link href="/hubs/personal-finance">💰 01 Personal Finance</Link>
            </li>
            <li>
              <Link href="/hubs/opportunity">🚀 05 Opportunity</Link>
            </li>
            <li>
              <Link href="/manage">🏛️ 06 Club Management</Link>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const origin = hub.origin || hubOrigin(branch);

  return (
    <div className="section hub-gate">
      <Link href="/lobby" className="hub-back-inline">
        ← Phòng khách
      </Link>
      <div className={`hub-soon-card tone-${branch.tone}`}>
        <span className="hub-soon-ico">{branch.icon}</span>
        <h1>
          {branch.id} · {branch.title}
        </h1>
        <p className="muted">{branch.subtitle}</p>
        <p>
          Folder: <strong>{hub.modulePath || branch.modulePath}</strong>
        </p>

        {hub.live ? (
          <>
            <p className="hub-live-ok">● Module đang chạy</p>
            <p className="muted">
              <code>{origin}</code>
            </p>
            <a className="btn-primary solid hub-open-btn" href={origin}>
              Mở giao diện {branch.title} →
            </a>
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Bấm nút phía trên để vào app đã build (tab hiện tại).
            </p>
          </>
        ) : (
          <>
            <p className="hub-live-down">
              ● Module chưa chạy — nên trang trống / lỗi khi mở thẳng
            </p>
            <p className="muted">
              Cần bật server tại <code>{origin}</code> rồi bấm lại nút dưới.
            </p>
            <pre className="hub-code">{hub.runHint || branch.runHint}</pre>
            <div className="hub-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.location.reload()}
              >
                Kiểm tra lại
              </button>
              <a className="btn-primary solid" href={origin}>
                Vẫn thử mở →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

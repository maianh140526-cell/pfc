# Personal Finance

Umbrella workspace for personal-finance products and experiments.

## What's in this repo

| Path | Description |
|------|-------------|
| **PFC-App/** | **Mobile web app (PWA) shell** — one app, one tab bar for every hub. `npm run build && npm start` → http://localhost:3200. See [ADR-009](./PFC-App/docs/adr/ADR-009-unified-mobile-app-shell.md). |
| **PFC-Management/** | **PFC Digital Hub** — requirements, Club Management production app, ADRs, reference clones. Primary build target. |
| **PFC-Management/apps/club/** | **Club Management app** (Next.js) — run this for G0–G5 club ops. |
| **PFC-Personal Finance/** | **Personal Finance zone (PFC Quỹ)** — Flutter + Firebase. Upstream: [finance_app](https://github.com/buiductiendung06-crypto/finance_app). |
| **PFC-Opportunity Hub/** | Opportunity Hub — architecture pack + Next.js `web/`. |
| **BeeCount-Cloud/** | Local Docker compose for BeeCount Cloud — exploration / reference. |
| **Test/** | Scratch / experiments. |

## PFC Digital Hub (main track)

PFC is a **Personal Finance Club** digital hub for students/young adults:

**MANAGE → LEARN → BUILD → EARN → GROW → CONTRIBUTE**

Current tracks:

- **Club Management** — plan `PFC-Management/Club_Management_TodoList.md`, app `PFC-Management/apps/club` (`npm run dev`)
- **Personal Finance (Quỹ)** — `PFC-Personal Finance/` (`flutter pub get` → `flutter run -d chrome`)
- **Opportunity Hub** — `PFC-Opportunity Hub/`

References reused (Club): Atrium (RBAC), ClubHub-Pro (task workflow), ClubKit (Drizzle/SQLite DX)

## Máy khác

Đọc [NEXT.md](./NEXT.md). Pull repo, mở folder này trong Cursor, dán lệnh trong file đó để làm module tiếp theo. Không cần tải lại SRS.

## Remote

- GitHub: https://github.com/hienlefin/PFC  
  *(Repo name is historical; project scope = Personal Finance.)*

## Quick notes

- Do not commit secrets, deploy keys, or `BeeCount-Cloud/data/`.
- Reference apps under `PFC-Management/References/` are third-party snapshots for implementation patterns only.

# PFC App — mobile web app (PWA)

The unified PFC Digital Hub app shell. Open it in a phone browser for an app-like experience, or install it to the home screen.

```bash
npm install
npm run build && npm start   # http://localhost:3200
```

- Agent / contributor rules: [AGENTS.md](./AGENTS.md)
- Architecture decision: [docs/adr/ADR-009](./docs/adr/ADR-009-unified-mobile-app-shell.md)
- Research and roadmap: [../MOBILE_WEB_APP.md](../MOBILE_WEB_APP.md)

## P1 scope (done)
- Installable PWA: manifest, icons from the official logo, service worker, offline page, update prompt
- Android install button; iOS "Thêm vào MH chính" guide
- 5-tab mobile shell, sticky headers with back, page transitions, safe-area support
- Light / Dark / Auto themes; WCAG contrast tests on tokens
- Shared UI kit (`/more/ui-kit`)

## Hub interiors (done, ADR-010)
- **Tài chính** — full Personal Finance on the PFC database: dashboard, transactions (search/filter/edit/duplicate/delete), income & expense overview, categories, budgets, saving goals, saving challenges, reports (month/quarter/year), CSV export/import, calculators (compound interest, loan, retirement, personal income tax, deposit rates)
- **Cơ hội** — discover/search/filter, detail, save, internal apply with CV, external apply tracking, applications timeline, reminders, provider tools, reviewer queue (via the Opportunity service)
- **Câu lạc bộ** — overview, Kanban/Timeline tasks with checklist, comments and review, members with approval/roles/teams, activities & linked events, notifications, approval queue, teams, report, documents (via the Club service)
- PFC account: register, login, change password

Next: P2 single sign-on across hubs (remove the interim Club/Opportunity logins).

/**
 * Forward-only, append-only migrations. Never edit a shipped entry — add a new version.
 * Money is stored as INTEGER VND (no minor unit) to avoid float drift.
 */
/**
 * `rebuild: true` = a table rebuild (SQLite cannot ALTER a CHECK constraint): the runner switches foreign
 * keys OFF around one transaction, runs PRAGMA foreign_key_check, then switches them back ON.
 */
export const MIGRATIONS: ReadonlyArray<{ version: number; statements: string[]; rebuild?: boolean }> = [
  {
    version: 1,
    statements: [
      // Platform identity (FR-CORE-001/002, FR-X-001): one member across hubs.
      `CREATE TABLE members (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        actor_id TEXT,
        action TEXT NOT NULL,
        object_ref TEXT,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      // Personal Finance (FR-FIN-001..007). Every row is owned by exactly one member.
      `CREATE TABLE fin_categories (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX fin_categories_member ON fin_categories(member_id, type)`,
      `CREATE TABLE fin_transactions (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        category_id TEXT NOT NULL REFERENCES fin_categories(id),
        note TEXT NOT NULL DEFAULT '',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX fin_transactions_member_date ON fin_transactions(member_id, occurred_at)`,
      `CREATE TABLE fin_budgets (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES fin_categories(id),
        month TEXT NOT NULL,
        limit_amount INTEGER NOT NULL CHECK (limit_amount > 0),
        created_at TEXT NOT NULL,
        UNIQUE (member_id, category_id, month)
      )`,
      `CREATE TABLE fin_goals (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        target_amount INTEGER NOT NULL CHECK (target_amount > 0),
        current_amount INTEGER NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
        deadline TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE fin_challenges (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        challenge_type TEXT NOT NULL CHECK (challenge_type IN ('saving','spending_limit')),
        target_amount INTEGER NOT NULL CHECK (target_amount > 0),
        duration_days INTEGER NOT NULL CHECK (duration_days > 0),
        start_date TEXT NOT NULL,
        first_check_in TEXT,
        last_check_in TEXT,
        checked_days INTEGER NOT NULL DEFAULT 0,
        progress_amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','success','failed')),
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      // Platform roles (src/platform/roles.ts). Default: Thành viên.
      "ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'thanh_vien'",
      "ALTER TABLE members ADD COLUMN department TEXT",
      "ALTER TABLE members ADD COLUMN locked INTEGER NOT NULL DEFAULT 0",
    ],
  },
  {
    version: 3,
    statements: [
      // Education Hub (FR-EDU-001…008). status: draft|submitted|published|rejected|archived
      `CREATE TABLE edu_courses (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL CHECK (topic IN ('finance','development')),
        level TEXT NOT NULL CHECK (level IN ('basic','intermediate','advanced')),
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE edu_lessons (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('video','reading')),
        video_url TEXT,
        body TEXT NOT NULL DEFAULT '',
        duration_min INTEGER NOT NULL DEFAULT 5
      )`,
      "CREATE INDEX edu_lessons_course ON edu_lessons(course_id, position)",
      `CREATE TABLE edu_enrollments (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
        enrolled_at TEXT NOT NULL,
        completed_at TEXT,
        PRIMARY KEY (member_id, course_id)
      )`,
      `CREATE TABLE edu_lesson_progress (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL REFERENCES edu_lessons(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (member_id, lesson_id)
      )`,
      `CREATE TABLE edu_quizzes (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        course_id TEXT REFERENCES edu_courses(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL CHECK (topic IN ('finance','development')),
        pass_pct INTEGER NOT NULL DEFAULT 70 CHECK (pass_pct BETWEEN 1 AND 100),
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE edu_questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES edu_quizzes(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT 'basic'
      )`,
      `CREATE TABLE edu_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES edu_quizzes(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        answers_json TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE edu_resources (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        title TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('ebook','template','checklist','article')),
        topic TEXT NOT NULL CHECK (topic IN ('finance','development')),
        url TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE edu_threads (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        topic TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0,
        locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL
      )`,
      `CREATE TABLE edu_replies (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES edu_threads(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES members(id),
        body TEXT NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE edu_thread_likes (
        thread_id TEXT NOT NULL REFERENCES edu_threads(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        PRIMARY KEY (thread_id, member_id)
      )`,
    ],
  },
  {
    version: 4,
    statements: [
      // Marketplace (FR-MKT-001…009). Money: INTEGER VND. Seller verification is risk-based (Q04).
      `CREATE TABLE mkt_sellers (
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        shop_name TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
        reject_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE mkt_listings (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES members(id),
        kind TEXT NOT NULL CHECK (kind IN ('product','digital','service','course')),
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL CHECK (price >= 0),
        stock INTEGER CHECK (stock IS NULL OR stock >= 0),
        delivery TEXT NOT NULL CHECK (delivery IN ('ship','pickup','online')),
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      "CREATE INDEX mkt_listings_status ON mkt_listings(status, kind)",
      `CREATE TABLE mkt_cart_items (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        listing_id TEXT NOT NULL REFERENCES mkt_listings(id) ON DELETE CASCADE,
        qty INTEGER NOT NULL CHECK (qty > 0),
        added_at TEXT NOT NULL,
        PRIMARY KEY (member_id, listing_id)
      )`,
      `CREATE TABLE mkt_favorites (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        listing_id TEXT NOT NULL REFERENCES mkt_listings(id) ON DELETE CASCADE,
        PRIMARY KEY (member_id, listing_id)
      )`,
      `CREATE TABLE mkt_orders (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        buyer_id TEXT NOT NULL REFERENCES members(id),
        seller_id TEXT NOT NULL REFERENCES members(id),
        status TEXT NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cod','bank_transfer','in_person')),
        payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
        total INTEGER NOT NULL CHECK (total >= 0),
        recipient_name TEXT NOT NULL,
        recipient_phone TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        cancel_reason TEXT,
        checkout_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      "CREATE INDEX mkt_orders_buyer ON mkt_orders(buyer_id, created_at)",
      "CREATE INDEX mkt_orders_seller ON mkt_orders(seller_id, created_at)",
      "CREATE UNIQUE INDEX mkt_orders_checkout ON mkt_orders(buyer_id, seller_id, checkout_key)",
      `CREATE TABLE mkt_order_items (
        order_id TEXT NOT NULL REFERENCES mkt_orders(id) ON DELETE CASCADE,
        listing_id TEXT NOT NULL REFERENCES mkt_listings(id),
        title TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        qty INTEGER NOT NULL CHECK (qty > 0),
        PRIMARY KEY (order_id, listing_id)
      )`,
      `CREATE TABLE mkt_order_events (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES mkt_orders(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE mkt_reviews (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES mkt_orders(id),
        listing_id TEXT NOT NULL REFERENCES mkt_listings(id) ON DELETE CASCADE,
        buyer_id TEXT NOT NULL REFERENCES members(id),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (order_id, listing_id)
      )`,
    ],
  },
  {
    version: 5,
    statements: [
      // Project Marketplace (FR-PROJ-001…008, SRS §9 Project lifecycle, BR-006 controlled collaboration).
      `CREATE TABLE prj_projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES members(id),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        skills TEXT NOT NULL DEFAULT '',
        recruiting INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      )`,
      `CREATE INDEX prj_projects_status ON prj_projects (status, updated_at)`,
      `CREATE TABLE prj_members (
        project_id TEXT NOT NULL REFERENCES prj_projects(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        scope TEXT NOT NULL DEFAULT '',
        invited_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (project_id, member_id)
      )`,
      `CREATE INDEX prj_members_member ON prj_members (member_id, status)`,
      `CREATE TABLE prj_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES prj_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        assignee_id TEXT REFERENCES members(id),
        due_date TEXT,
        created_by TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX prj_tasks_project ON prj_tasks (project_id, status)`,
      `CREATE TABLE prj_updates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES prj_projects(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES members(id),
        kind TEXT NOT NULL DEFAULT 'update',
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX prj_updates_project ON prj_updates (project_id, created_at)`,
      `CREATE TABLE prj_links (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES prj_projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'team',
        created_by TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE prj_feedback (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES prj_projects(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES members(id),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL DEFAULT '',
        hidden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (project_id, author_id)
      )`,
      `CREATE TABLE prj_views (
        project_id TEXT NOT NULL REFERENCES prj_projects(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        day TEXT NOT NULL,
        PRIMARY KEY (project_id, member_id, day)
      )`,
    ],
  },
  {
    version: 6,
    statements: [
      // Identity & Access (FR-CORE-001, tasks 039–044): email verification, reset tokens, social sign-in, session revocation.
      `ALTER TABLE members ADD COLUMN email_verified_at TEXT`,
      `ALTER TABLE members ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0`,
      // Accounts created before verification existed are treated as verified (they were created by admins / seed).
      `UPDATE members SET email_verified_at = created_at WHERE email_verified_at IS NULL`,
      `CREATE TABLE auth_tokens (
        token_hash TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX auth_tokens_member ON auth_tokens (member_id, purpose)`,
      `CREATE TABLE member_identities (
        provider TEXT NOT NULL,
        subject TEXT NOT NULL,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        email TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (provider, subject)
      )`,
      `CREATE INDEX member_identities_member ON member_identities (member_id)`,
    ],
  },
  {
    version: 7,
    statements: [
      // Shared rate-limit counters (NFR-S-007): works across serverless instances. Keys are SHA-256 hashes (no emails/IPs stored).
      `CREATE TABLE rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
      )`,
      // Uploaded files (images for listings, avatars…). Bytes live in storage (local disk in dev, Vercel Blob in production).
      `CREATE TABLE uploads (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES members(id),
        purpose TEXT NOT NULL,
        mime TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        storage_key TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX uploads_owner ON uploads (owner_id, created_at)`,
      `ALTER TABLE mkt_listings ADD COLUMN images TEXT NOT NULL DEFAULT '[]'`,
    ],
  },
  {
    version: 8,
    statements: [
      // G1 profile (mockup 266), onboarding (7), language (270), privacy (272), deletion (275).
      `ALTER TABLE members ADD COLUMN phone TEXT`,
      `ALTER TABLE members ADD COLUMN birth_date TEXT`,
      `ALTER TABLE members ADD COLUMN gender TEXT`,
      `ALTER TABLE members ADD COLUMN address TEXT`,
      `ALTER TABLE members ADD COLUMN bio TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE members ADD COLUMN avatar_url TEXT`,
      `ALTER TABLE members ADD COLUMN interests TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE members ADD COLUMN onboarded_at TEXT`,
      `ALTER TABLE members ADD COLUMN locale TEXT NOT NULL DEFAULT 'vi'`,
      `ALTER TABLE members ADD COLUMN privacy TEXT NOT NULL DEFAULT '{}'`,
      `ALTER TABLE members ADD COLUMN deleted_at TEXT`,
      // Existing accounts skip onboarding.
      `UPDATE members SET onboarded_at = created_at WHERE onboarded_at IS NULL`,
      // One-time-token payload (new email for "đổi email").
      `ALTER TABLE auth_tokens ADD COLUMN payload TEXT`,
      // G1 devices (mockup 269): every signed-in browser is a row; revoking it signs that device out.
      `CREATE TABLE member_sessions (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        device TEXT NOT NULL,
        ip_hint TEXT,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT
      )`,
      `CREATE INDEX member_sessions_member ON member_sessions (member_id, revoked_at)`,
      // G1 two-step login (mockup 268): TOTP secret encrypted at rest + hashed backup codes.
      `CREATE TABLE member_totp (
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        secret_enc TEXT NOT NULL,
        enabled_at TEXT,
        backup_codes TEXT NOT NULL DEFAULT '[]',
        last_step INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      // G1 consent history (Nghị định 13/2023: record what was agreed and when).
      `CREATE TABLE member_consents (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        granted INTEGER NOT NULL,
        version TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX member_consents_member ON member_consents (member_id, kind, created_at)`,
      // G2 notification center (NOT-01…05).
      `CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        href TEXT,
        dedupe_key TEXT,
        created_at TEXT NOT NULL,
        read_at TEXT
      )`,
      `CREATE INDEX notifications_member ON notifications (member_id, created_at)`,
      `CREATE UNIQUE INDEX notifications_dedupe ON notifications (member_id, dedupe_key)`,
      `CREATE TABLE notification_prefs (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        channel TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        PRIMARY KEY (member_id, category, channel)
      )`,
      `CREATE TABLE push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        device TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_ok_at TEXT
      )`,
      `CREATE INDEX push_subscriptions_member ON push_subscriptions (member_id)`,
    ],
  },
  {
    version: 9,
    statements: [
      // G3 Community Hub (COM-01…22, mockups 73–84, 103–108, 133–139).
      `CREATE TABLE com_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL DEFAULT 'other',
        visibility TEXT NOT NULL DEFAULT 'public',
        cover_url TEXT,
        owner_id TEXT NOT NULL REFERENCES members(id),
        status TEXT NOT NULL DEFAULT 'active',
        archived_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE com_group_members (
        group_id TEXT NOT NULL REFERENCES com_groups(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        PRIMARY KEY (group_id, member_id)
      )`,
      `CREATE INDEX com_group_members_member ON com_group_members (member_id, status)`,
      `CREATE TABLE com_posts (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        group_id TEXT REFERENCES com_groups(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        topic TEXT NOT NULL DEFAULT 'other',
        tags TEXT NOT NULL DEFAULT '[]',
        images TEXT NOT NULL DEFAULT '[]',
        allow_comments INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'published',
        hidden_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL
      )`,
      `CREATE INDEX com_posts_feed ON com_posts (status, last_activity_at)`,
      `CREATE INDEX com_posts_group ON com_posts (group_id, status, created_at)`,
      `CREATE INDEX com_posts_author ON com_posts (author_id, created_at)`,
      `CREATE TABLE com_poll_options (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES com_posts(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        position INTEGER NOT NULL
      )`,
      `CREATE TABLE com_poll_votes (
        post_id TEXT NOT NULL REFERENCES com_posts(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        option_id TEXT NOT NULL REFERENCES com_poll_options(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, member_id)
      )`,
      `CREATE TABLE com_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES com_posts(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES members(id),
        parent_id TEXT,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'visible',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX com_comments_post ON com_comments (post_id, created_at)`,
      `CREATE TABLE com_reactions (
        post_id TEXT NOT NULL REFERENCES com_posts(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, member_id)
      )`,
      `CREATE TABLE com_saved (
        post_id TEXT NOT NULL REFERENCES com_posts(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, member_id)
      )`,
      `CREATE TABLE com_follows (
        follower_id TEXT NOT NULL REFERENCES members(id),
        followee_id TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY (follower_id, followee_id)
      )`,
      `CREATE INDEX com_follows_followee ON com_follows (followee_id)`,
      `CREATE TABLE com_blocks (
        blocker_id TEXT NOT NULL REFERENCES members(id),
        blocked_id TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY (blocker_id, blocked_id)
      )`,
      `CREATE TABLE com_reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL REFERENCES members(id),
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        decided_by TEXT,
        decision_note TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (reporter_id, target_type, target_id)
      )`,
      `CREATE INDEX com_reports_status ON com_reports (status, created_at)`,
      // Direct messages (mockups 79–80, 137–139).
      `CREATE TABLE dm_conversations (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL DEFAULT 'direct',
        pair_key TEXT UNIQUE,
        title TEXT,
        created_by TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL
      )`,
      `CREATE TABLE dm_participants (
        conversation_id TEXT NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        last_read_at TEXT,
        PRIMARY KEY (conversation_id, member_id)
      )`,
      `CREATE INDEX dm_participants_member ON dm_participants (member_id)`,
      `CREATE TABLE dm_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES members(id),
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX dm_messages_conv ON dm_messages (conversation_id, created_at)`,
    ],
  },
  {
    version: 10,
    statements: [
      // G4 Shared Event Engine (EVT-01…15, A01…05; mockups 70–72, 118–120, 140–141). Times: Vietnam local "YYYY-MM-DDTHH:mm".
      `CREATE TABLE evt_events (
        id TEXT PRIMARY KEY,
        organizer_id TEXT NOT NULL REFERENCES members(id),
        group_id TEXT REFERENCES com_groups(id),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'other',
        mode TEXT NOT NULL DEFAULT 'offline',
        location TEXT NOT NULL DEFAULT '',
        online_url TEXT,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        registration_deadline TEXT,
        cover_url TEXT,
        capacity INTEGER,
        pay_at_door INTEGER NOT NULL DEFAULT 0,
        agenda TEXT NOT NULL DEFAULT '[]',
        speakers TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        cancel_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      )`,
      `CREATE INDEX evt_events_list ON evt_events (status, starts_at)`,
      `CREATE TABLE evt_ticket_types (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES evt_events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL CHECK (price >= 0),
        capacity INTEGER,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE evt_registrations (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES evt_events(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        ticket_type_id TEXT NOT NULL REFERENCES evt_ticket_types(id),
        status TEXT NOT NULL,
        price INTEGER NOT NULL,
        paid INTEGER NOT NULL DEFAULT 0,
        payment_id TEXT,
        attendee_name TEXT NOT NULL,
        attendee_email TEXT NOT NULL,
        attendee_phone TEXT NOT NULL DEFAULT '',
        ticket_code TEXT NOT NULL UNIQUE,
        hold_until TEXT,
        checked_in_at TEXT,
        checked_in_by TEXT,
        cancel_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX evt_registrations_event ON evt_registrations (event_id, status)`,
      `CREATE INDEX evt_registrations_member ON evt_registrations (member_id, created_at)`,
      `CREATE UNIQUE INDEX evt_registrations_one ON evt_registrations (event_id, member_id) WHERE status IN ('pending_payment','confirmed')`,
      `CREATE TABLE evt_favorites (
        event_id TEXT NOT NULL REFERENCES evt_events(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY (event_id, member_id)
      )`,
      `CREATE TABLE evt_reminders (
        event_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        PRIMARY KEY (event_id, kind)
      )`,
    ],
  },
  {
    version: 11,
    statements: [
      // G5 Payments (PAY-01…08, A01…05; mockups 61–64, 68–69, 133–135). INTEGER VND. Provider: VNPAY.
      `CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        txn_ref TEXT NOT NULL UNIQUE,
        payer_id TEXT NOT NULL REFERENCES members(id),
        purpose TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        provider TEXT NOT NULL DEFAULT 'vnpay',
        status TEXT NOT NULL DEFAULT 'pending',
        provider_txn_no TEXT,
        bank_code TEXT,
        card_type TEXT,
        response_code TEXT,
        paid_at TEXT,
        expires_at TEXT NOT NULL,
        return_path TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX payments_payer ON payments (payer_id, created_at)`,
      `CREATE INDEX payments_status ON payments (status, expires_at)`,
      `CREATE TABLE payment_items (
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        ref_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        payee_id TEXT NOT NULL REFERENCES members(id),
        amount INTEGER NOT NULL,
        fee INTEGER NOT NULL DEFAULT 0,
        payout_id TEXT,
        PRIMARY KEY (payment_id, ref_type, ref_id)
      )`,
      `CREATE INDEX payment_items_ref ON payment_items (ref_type, ref_id)`,
      `CREATE INDEX payment_items_payee ON payment_items (payee_id, payout_id)`,
      `CREATE TABLE payment_events (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE refunds (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id),
        ref_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        requester_id TEXT NOT NULL REFERENCES members(id),
        amount INTEGER NOT NULL CHECK (amount > 0),
        reason TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'requested',
        decided_by TEXT,
        decision_note TEXT,
        provider_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX refunds_status ON refunds (status, created_at)`,
      `CREATE UNIQUE INDEX refunds_one_open ON refunds (ref_type, ref_id) WHERE status IN ('requested','approved','processing')`,
      `CREATE TABLE refund_events (
        id TEXT PRIMARY KEY,
        refund_id TEXT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        note TEXT,
        actor_id TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE payouts (
        id TEXT PRIMARY KEY,
        payee_id TEXT NOT NULL REFERENCES members(id),
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT NOT NULL DEFAULT '',
        paid_at TEXT,
        paid_by TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 12,
    rebuild: true,
    statements: [
      // Marketplace orders accept online payment (VNPAY) and a "refunded" payment state. SQLite cannot alter a
      // CHECK constraint, so the table is rebuilt (rows copied unchanged; child tables keep their references).
      `CREATE TABLE mkt_orders_new (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        buyer_id TEXT NOT NULL REFERENCES members(id),
        seller_id TEXT NOT NULL REFERENCES members(id),
        status TEXT NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cod','bank_transfer','in_person','vnpay')),
        payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
        total INTEGER NOT NULL CHECK (total >= 0),
        recipient_name TEXT NOT NULL,
        recipient_phone TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        cancel_reason TEXT,
        checkout_key TEXT,
        payment_due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `INSERT INTO mkt_orders_new (id, code, buyer_id, seller_id, status, payment_method, payment_status, total, recipient_name, recipient_phone, address, note, cancel_reason, checkout_key, created_at, updated_at)
       SELECT id, code, buyer_id, seller_id, status, payment_method, payment_status, total, recipient_name, recipient_phone, address, note, cancel_reason, checkout_key, created_at, updated_at FROM mkt_orders`,
      `DROP TABLE mkt_orders`,
      `ALTER TABLE mkt_orders_new RENAME TO mkt_orders`,
      `CREATE INDEX mkt_orders_buyer ON mkt_orders(buyer_id, created_at)`,
      `CREATE INDEX mkt_orders_seller ON mkt_orders(seller_id, created_at)`,
      `CREATE UNIQUE INDEX mkt_orders_checkout ON mkt_orders(buyer_id, seller_id, checkout_key)`,
    ],
  },
  {
    version: 13,
    statements: [
      // G6 Finance: investment tracker (owner-only; prices are entered by the member, no market feed).
      `CREATE TABLE fin_holdings (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL CHECK (kind IN ('stock','fund','bond','gold','crypto','deposit','other')),
        quantity REAL NOT NULL CHECK (quantity > 0),
        avg_cost INTEGER NOT NULL CHECK (avg_cost >= 0),
        current_price INTEGER NOT NULL CHECK (current_price >= 0),
        price_updated_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX fin_holdings_member ON fin_holdings (member_id)`,
      // G6 Finance: "Ngon – Bổ – Rẻ" places shared by members (FIN-26…34), with reviews.
      `CREATE TABLE fin_places (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('food','drink','study','shopping','service','other')),
        address TEXT NOT NULL,
        area TEXT NOT NULL DEFAULT '',
        price_level INTEGER NOT NULL CHECK (price_level BETWEEN 1 AND 3),
        description TEXT NOT NULL DEFAULT '',
        cover_url TEXT,
        hidden INTEGER NOT NULL DEFAULT 0,
        hidden_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX fin_places_cat ON fin_places (category, created_at)`,
      `CREATE TABLE fin_place_reviews (
        id TEXT PRIMARY KEY,
        place_id TEXT NOT NULL REFERENCES fin_places(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL DEFAULT '',
        avg_spend INTEGER CHECK (avg_spend IS NULL OR avg_spend >= 0),
        created_at TEXT NOT NULL,
        UNIQUE (place_id, member_id)
      )`,
      `CREATE TABLE fin_place_saves (
        place_id TEXT NOT NULL REFERENCES fin_places(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (place_id, member_id)
      )`,
      // G6 Education: timed quizzes (server-side clock per attempt).
      `ALTER TABLE edu_quizzes ADD COLUMN time_limit_min INTEGER`,
      `CREATE TABLE edu_attempt_starts (
        quiz_id TEXT NOT NULL REFERENCES edu_quizzes(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        PRIMARY KEY (quiz_id, member_id)
      )`,
      // G6 Projects: collaborator profiles ("Tìm cộng sự").
      `CREATE TABLE prj_collab_profiles (
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        headline TEXT NOT NULL,
        skills TEXT NOT NULL DEFAULT '',
        looking_for TEXT NOT NULL DEFAULT '',
        availability TEXT NOT NULL DEFAULT 'part_time' CHECK (availability IN ('few_hours','part_time','full_time')),
        open INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )`,
      // G7 Rewards: append-only points ledger (idempotent per rule + reference), catalog, redemptions, referrals.
      `CREATE TABLE pts_ledger (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL CHECK (delta != 0),
        kind TEXT NOT NULL CHECK (kind IN ('earn','redeem','refund','adjust')),
        rule_key TEXT,
        ref TEXT,
        note TEXT NOT NULL DEFAULT '',
        created_by TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX pts_ledger_once ON pts_ledger (member_id, rule_key, ref) WHERE rule_key IS NOT NULL AND ref IS NOT NULL`,
      `CREATE INDEX pts_ledger_member ON pts_ledger (member_id, created_at)`,
      `CREATE TABLE pts_rewards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        partner TEXT NOT NULL DEFAULT '',
        cost INTEGER NOT NULL CHECK (cost > 0),
        stock INTEGER CHECK (stock IS NULL OR stock >= 0),
        min_tier TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE pts_redemptions (
        id TEXT PRIMARY KEY,
        reward_id TEXT NOT NULL REFERENCES pts_rewards(id),
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        cost INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('requested','fulfilled','cancelled')),
        note TEXT NOT NULL DEFAULT '',
        decided_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE pts_codes (
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE
      )`,
      `CREATE TABLE pts_referrals (
        referee_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        referrer_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        rewarded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      // G8 Admin: settings / feature flags, member restrictions, support tickets, notification campaigns.
      `CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE member_restrictions (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('community','messages','market_sell','events_host')),
        reason TEXT NOT NULL,
        until TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        lifted_at TEXT,
        lifted_by TEXT
      )`,
      `CREATE INDEX member_restrictions_member ON member_restrictions (member_id, kind)`,
      `CREATE TABLE support_tickets (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open','answered','closed')),
        assignee_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX support_tickets_status ON support_tickets (status, updated_at)`,
      `CREATE TABLE support_messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL,
        staff INTEGER NOT NULL DEFAULT 0,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE notify_campaigns (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        href TEXT,
        audience TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','sent')),
        recipients INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sent_at TEXT
      )`,
    ],
  },
  {
    version: 14,
    rebuild: true,
    statements: [
      // Marketplace listings: event tickets (Shared Event Engine), links to an Education course or an event,
      // tags and an explicit currency. SQLite cannot alter the kind CHECK, so the table is rebuilt (rows kept).
      `CREATE TABLE mkt_listings_new (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES members(id),
        kind TEXT NOT NULL CHECK (kind IN ('product','digital','service','course','ticket')),
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL CHECK (price >= 0),
        currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
        stock INTEGER CHECK (stock IS NULL OR stock >= 0),
        delivery TEXT NOT NULL CHECK (delivery IN ('ship','pickup','online')),
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        images TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '',
        course_id TEXT REFERENCES edu_courses(id) ON DELETE SET NULL,
        event_id TEXT REFERENCES evt_events(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `INSERT INTO mkt_listings_new (id, seller_id, kind, category, title, description, price, stock, delivery, status, reject_reason, images, created_at, updated_at)
       SELECT id, seller_id, kind, category, title, description, price, stock, delivery, status, reject_reason, images, created_at, updated_at FROM mkt_listings`,
      `DROP TABLE mkt_listings`,
      `ALTER TABLE mkt_listings_new RENAME TO mkt_listings`,
      `CREATE INDEX mkt_listings_status ON mkt_listings(status, kind)`,
      `CREATE INDEX mkt_listings_seller ON mkt_listings(seller_id, updated_at)`,
      // Risk-based seller verification: "basic" (self-serve, low-risk items) and "verified" (reviewed by staff).
      `ALTER TABLE mkt_sellers ADD COLUMN level TEXT NOT NULL DEFAULT 'basic'`,
      `ALTER TABLE mkt_sellers ADD COLUMN verify_status TEXT NOT NULL DEFAULT 'none'`,
      `ALTER TABLE mkt_sellers ADD COLUMN verify_note TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_sellers ADD COLUMN legal_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_sellers ADD COLUMN phone TEXT NOT NULL DEFAULT ''`,
      `UPDATE mkt_sellers SET level = 'verified' WHERE status = 'approved'`,
      // Education: member uploads (PDF documents) and replies to forum comments.
      `ALTER TABLE edu_replies ADD COLUMN parent_id TEXT`,
    ],
  },
  {
    version: 15,
    rebuild: true,
    statements: [
      // Education: documents / exercises by subject with photos and files attached, quizzes with extra material,
      // a resource may point to a quiz. Marketplace: per-type details. Opportunity: outside sources + leader posts.
      `CREATE TABLE edu_resources_new (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES members(id),
        title TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('ebook','template','checklist','article','exercise','notes','exam')),
        topic TEXT NOT NULL CHECK (topic IN ('finance','development')),
        subject TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        quiz_id TEXT REFERENCES edu_quizzes(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        reject_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `INSERT INTO edu_resources_new (id, author_id, title, kind, topic, url, description, status, reject_reason, created_at, updated_at)
       SELECT id, author_id, title, kind, topic, url, description, status, reject_reason, created_at, updated_at FROM edu_resources`,
      `DROP TABLE edu_resources`,
      `ALTER TABLE edu_resources_new RENAME TO edu_resources`,
      `ALTER TABLE edu_quizzes ADD COLUMN subject TEXT NOT NULL DEFAULT ''`,
      `CREATE TABLE edu_attachments (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('resource','quiz','lesson')),
        owner_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('image','file')),
        url TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX edu_attachments_owner ON edu_attachments (owner_type, owner_id, position)`,
      `ALTER TABLE mkt_listings ADD COLUMN item_condition TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN delivery_area TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN service_scope TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN availability TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN quotation TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN access_info TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN file_url TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE mkt_listings ADD COLUMN file_name TEXT NOT NULL DEFAULT ''`,
      // Opportunities shown in the PFC app that do not live in the Opportunity hub: outside feeds and posts by leaders.
      `CREATE TABLE ext_opportunities (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('internship','job','competition','scholarship')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        organization TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        posted_at TEXT,
        deadline_at TEXT,
        state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed')),
        author_id TEXT REFERENCES members(id) ON DELETE SET NULL,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (source, external_id)
      )`,
      `CREATE INDEX ext_opportunities_list ON ext_opportunities (state, type, posted_at)`,
    ],
  },
];

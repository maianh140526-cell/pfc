import "server-only";
import { assertAllowed } from "@/platform/admin/restrictions";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { ActionError } from "@/platform/errors";
import { notify } from "@/platform/notifications/service";
import { allowAttempt } from "@/platform/rate-limit";
import type { Actor } from "@/platform/roles";
import { canStartConversation, pairKey, type MessagePolicy } from "../domain/rules";

/**
 * Direct messages (mockups 79–80). Only participants can read a conversation. Starting one respects
 * the recipient's privacy setting and blocks; blocks also stop sending inside an existing conversation.
 */
const now = () => new Date().toISOString();

async function policyOf(memberId: string): Promise<MessagePolicy | null> {
  const m = await one<{ privacy: string; deleted_at: string | null; locked: number }>("SELECT privacy, deleted_at, locked FROM members WHERE id = ?", [memberId]);
  if (!m || m.deleted_at || Number(m.locked) === 1) return null;
  try {
    const p = (JSON.parse(m.privacy) as { messages?: MessagePolicy }).messages;
    return p === "following" || p === "none" ? p : "members";
  } catch {
    return "members";
  }
}

async function blockedEitherWay(a: string, b: string): Promise<boolean> {
  return !!(await one("SELECT 1 AS x FROM com_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", [a, b, b, a]));
}

/** Opens (or reuses) the 1-1 conversation with `otherId`. */
export async function startConversation(actor: Actor, otherId: string): Promise<string> {
  await assertAllowed(actor.id, "messages", "messages");
  const existing = await one<{ id: string }>("SELECT id FROM dm_conversations WHERE pair_key = ?", [pairKey(actor.id, otherId)]);
  if (existing) return existing.id;
  const policy = await policyOf(otherId);
  if (!policy) throw new ActionError("Không tìm thấy thành viên.");
  const follows = !!(await one("SELECT 1 AS x FROM com_follows WHERE follower_id = ? AND followee_id = ?", [otherId, actor.id]));
  if (!canStartConversation(policy, follows, await blockedEitherWay(actor.id, otherId), otherId === actor.id)) {
    throw new ActionError(policy === "following" ? "Người này chỉ nhận tin nhắn từ người họ theo dõi." : "Không thể nhắn tin cho người này.", "not_allowed");
  }
  const id = randomUUID();
  const t = now();
  await run("INSERT INTO dm_conversations (id, kind, pair_key, created_by, created_at, last_message_at) VALUES (?, 'direct', ?, ?, ?, ?)", [id, pairKey(actor.id, otherId), actor.id, t, t]);
  await run("INSERT INTO dm_participants (conversation_id, member_id, last_read_at) VALUES (?, ?, ?), (?, ?, NULL)", [id, actor.id, t, id, otherId]);
  return id;
}

async function requireParticipant(actor: Actor, conversationId: string) {
  const p = await one<{ last_read_at: string | null }>("SELECT last_read_at FROM dm_participants WHERE conversation_id = ? AND member_id = ?", [conversationId, actor.id]);
  if (!p) throw new ActionError("Không tìm thấy cuộc trò chuyện.");
  return p;
}

export type Conversation = { id: string; otherId: string; otherName: string; otherAvatar: string | null; lastBody: string; lastAt: string; unread: number; lastMine: boolean };

export async function listConversations(actor: Actor): Promise<Conversation[]> {
  const rows = await all<{ id: string; other_id: string; other_name: string; other_avatar: string | null; last_message_at: string; last_read_at: string | null }>(
    `SELECT c.id, o.member_id AS other_id, m.full_name AS other_name, m.avatar_url AS other_avatar, c.last_message_at, me.last_read_at
     FROM dm_participants me JOIN dm_conversations c ON c.id = me.conversation_id
     JOIN dm_participants o ON o.conversation_id = c.id AND o.member_id != me.member_id
     JOIN members m ON m.id = o.member_id
     WHERE me.member_id = ? AND EXISTS (SELECT 1 FROM dm_messages x WHERE x.conversation_id = c.id)
     ORDER BY c.last_message_at DESC LIMIT 100`,
    [actor.id],
  );
  const out: Conversation[] = [];
  for (const r of rows) {
    const last = await one<{ body: string; sender_id: string; deleted_at: string | null }>("SELECT body, sender_id, deleted_at FROM dm_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1", [r.id]);
    const unread = await one<{ n: number }>("SELECT COUNT(*) AS n FROM dm_messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ? AND deleted_at IS NULL", [r.id, actor.id, r.last_read_at ?? ""]);
    out.push({
      id: r.id,
      otherId: r.other_id,
      otherName: r.other_name,
      otherAvatar: r.other_avatar,
      lastBody: last?.deleted_at ? "Tin nhắn đã bị gỡ" : (last?.body ?? ""),
      lastAt: r.last_message_at,
      unread: Number(unread?.n ?? 0),
      lastMine: last?.sender_id === actor.id,
    });
  }
  return out;
}

export async function unreadMessages(actor: Actor): Promise<number> {
  const r = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM dm_messages x JOIN dm_participants me ON me.conversation_id = x.conversation_id AND me.member_id = ?
     WHERE x.sender_id != ? AND x.deleted_at IS NULL AND x.created_at > COALESCE(me.last_read_at, '')`,
    [actor.id, actor.id],
  );
  return Number(r?.n ?? 0);
}

export type Message = { id: string; mine: boolean; body: string; createdAt: string; deleted: boolean };

/** Messages after `after` (ISO) for polling, or the latest 100. Opening the conversation marks it read. */
export async function getMessages(actor: Actor, conversationId: string, after?: string): Promise<{ other: { id: string; name: string; avatarUrl: string | null }; messages: Message[]; otherReadAt: string | null; canSend: boolean }> {
  await requireParticipant(actor, conversationId);
  const other = await one<{ id: string; name: string; avatarUrl: string | null; last_read_at: string | null }>(
    "SELECT m.id, m.full_name AS name, m.avatar_url AS avatarUrl, p.last_read_at FROM dm_participants p JOIN members m ON m.id = p.member_id WHERE p.conversation_id = ? AND p.member_id != ?",
    [conversationId, actor.id],
  );
  const rows = after
    ? await all<{ id: string; sender_id: string; body: string; created_at: string; deleted_at: string | null }>(
        "SELECT * FROM dm_messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at LIMIT 200",
        [conversationId, after],
      )
    : (
        await all<{ id: string; sender_id: string; body: string; created_at: string; deleted_at: string | null }>(
          "SELECT * FROM dm_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 100",
          [conversationId],
        )
      ).reverse();
  await run("UPDATE dm_participants SET last_read_at = ? WHERE conversation_id = ? AND member_id = ?", [now(), conversationId, actor.id]);
  return {
    other: { id: other?.id ?? "", name: other?.name ?? "Thành viên", avatarUrl: other?.avatarUrl ?? null },
    messages: rows.map((r) => ({ id: r.id, mine: r.sender_id === actor.id, body: r.deleted_at ? "" : r.body, createdAt: r.created_at, deleted: !!r.deleted_at })),
    otherReadAt: other?.last_read_at ?? null,
    canSend: !!other && !(await blockedEitherWay(actor.id, other.id)) && (await policyOf(other.id)) !== null,
  };
}

/** 30 messages / minute. The recipient gets one notification per unread burst (not one per message). */
export async function sendMessage(actor: Actor, conversationId: string, body: unknown): Promise<Message> {
  await assertAllowed(actor.id, "messages", "messages");
  const text = z.string().trim().min(1, "Nhập tin nhắn.").max(4000, "Tin nhắn tối đa 4000 ký tự.").parse(body);
  await requireParticipant(actor, conversationId);
  const other = await one<{ member_id: string; last_read_at: string | null }>("SELECT member_id, last_read_at FROM dm_participants WHERE conversation_id = ? AND member_id != ?", [conversationId, actor.id]);
  if (!other || (await policyOf(other.member_id)) === null) throw new ActionError("Người nhận không còn hoạt động.");
  if (await blockedEitherWay(actor.id, other.member_id)) throw new ActionError("Không thể gửi tin nhắn cho người này.", "blocked");
  if (!(await allowAttempt(`dm:${actor.id}`, 30, 60_000))) throw new ActionError("Bạn gửi quá nhanh, chờ một chút.", "rate_limited");
  const prev = await one<{ created_at: string }>("SELECT created_at FROM dm_messages WHERE conversation_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT 1", [conversationId, actor.id]);
  const id = randomUUID();
  const t = now();
  await run("INSERT INTO dm_messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)", [id, conversationId, actor.id, text, t]);
  await run("UPDATE dm_conversations SET last_message_at = ? WHERE id = ?", [t, conversationId]);
  await run("UPDATE dm_participants SET last_read_at = ? WHERE conversation_id = ? AND member_id = ?", [t, conversationId, actor.id]);
  const caughtUp = !prev || (other.last_read_at ?? "") >= prev.created_at;
  if (caughtUp) {
    const who = (await one<{ full_name: string }>("SELECT full_name FROM members WHERE id = ?", [actor.id]))?.full_name ?? "Ai đó";
    await notify(other.member_id, { category: "messages", title: `Tin nhắn mới từ ${who}`, body: text.slice(0, 100), href: `/messages/${conversationId}` });
  }
  return { id, mine: true, body: text, createdAt: t, deleted: false };
}

/** Senders can withdraw their own message. */
export async function deleteMessage(actor: Actor, messageId: string): Promise<void> {
  const n = await run("UPDATE dm_messages SET deleted_at = ? WHERE id = ? AND sender_id = ? AND deleted_at IS NULL", [now(), messageId, actor.id]);
  if (n !== 1) throw new ActionError("Không gỡ được tin nhắn này.");
}

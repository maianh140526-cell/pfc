import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getMessages } from "@/modules/community/server/messages";
import { ActionError } from "@/platform/errors";
import { Chat } from "./Chat";

export const metadata = { title: "Trò chuyện" };
export const dynamic = "force-dynamic";

/** Chat Conversation (mockup 80). Participants only. */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/messages/${id}`);
  let data;
  try {
    data = await getMessages(toActor(me), id);
  } catch (err) {
    if (err instanceof ActionError) notFound();
    throw err;
  }
  return <Chat conversationId={id} initial={data} />;
}

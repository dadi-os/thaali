import { hath } from "../../api";
import { copyText } from "../../desktop/clipboard";
import { saveFile } from "../../desktop/download";
import type { ActionList } from "../../interaction/actions";
import { isTextMediaType } from "../../lib/content/attachments";
import { applyThreadRead, getChatState, seqToMark, type ChatMessage, type Conversation } from "../../../store/chat";
import type { AttachmentSummary } from "../../../types/hath";

/** What a conversation's actions need from the surface that shows it. */
export type ConversationActionDeps = {
  /** Messages to you the conversation holds unread. */
  unread: number;
  /** Open the conversation's thread in the rail. */
  onOpenThread: () => void;
  /** Open the agent in the Hath page. */
  onOpenInHath: () => void;
};

/** Mark a conversation read through its newest confirmed message, as opening it would. */
async function markRead(agentId: string): Promise<void> {
  const state = getChatState();
  const seq = seqToMark(state.threads[agentId] ?? [], state.readSeq[agentId]);
  if (seq === null) {
    throw new Error("The thread's messages are not loaded; open it once to mark it read.");
  }
  const mark = await hath.markThreadRead(agentId, seq);
  applyThreadRead(mark.agent_id, mark.read_seq, mark.unread);
}

/** The actions on a conversation, declared once for its right-click menu: open its thread, open the agent in Hath, mark it read. */
export function conversationActions(conversation: Conversation, deps: ConversationActionDeps): ActionList {
  return [
    { id: "conversation.open", label: "Open thread", icon: "chevron", run: deps.onOpenThread },
    { id: "conversation.hath", label: "Open in Hath", icon: "graph", run: deps.onOpenInHath },
    "separator",
    {
      id: "conversation.read",
      label: "Mark read",
      icon: "check",
      disabledReason: deps.unread > 0 ? undefined : "Nothing unread",
      run: () => markRead(conversation.agent_id),
    },
    { id: "conversation.copy-name", label: "Copy agent name", icon: "copy", run: () => copyText(conversation.agent_name) },
  ];
}

/** The actions on a message, declared once for its right-click menu: copy its text. */
export function messageActions(message: ChatMessage): ActionList {
  return [{ id: "message.copy", label: "Copy text", icon: "copy", disabledReason: message.content ? undefined : "This message has no text", run: () => copyText(message.content) }];
}

/** Save a stored file through the desktop save dialog. */
async function saveAttachment(file: AttachmentSummary): Promise<void> {
  await saveFile(file.filename, await hath.getAttachmentBlob(file.id));
}

/** The actions on a stored file, declared once for its right-click menu: open it, copy it (its text, or its name for other files) and save it. */
export function attachmentActions(file: AttachmentSummary, onOpen: () => void): ActionList {
  const textual = isTextMediaType(file.media_type);
  return [
    { id: "attachment.open", label: "Open", icon: "eye", run: onOpen },
    textual
      ? { id: "attachment.copy", label: "Copy text", icon: "copy", run: async () => copyText(await hath.getAttachmentText(file.id)) }
      : { id: "attachment.copy", label: "Copy name", icon: "copy", run: () => copyText(file.filename) },
    { id: "attachment.save", label: "Save…", icon: "download", run: () => saveAttachment(file) },
  ];
}

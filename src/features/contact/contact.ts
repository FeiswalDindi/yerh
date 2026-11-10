export interface ContactDraft {
  name: string;
  email: string;
  topic: string;
  message: string;
}
export function emailDraftHref(recipient: string, draft: ContactDraft): string {
  const subject = `YERH enquiry: ${draft.topic}`;
  const body = `Hello YERH team,\n\n${draft.message}\n\nFrom: ${draft.name}\nReply to: ${draft.email}`;
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

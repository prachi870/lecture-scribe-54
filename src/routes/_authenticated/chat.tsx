import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "AI Chat — ALIP" }, { name: "description", content: "Chat with your lectures." }] }),
  component: () => <ComingSoon title="AI Chat" description="Ask anything about your lectures. Every answer will cite a timestamp." icon={MessagesSquare} />,
});

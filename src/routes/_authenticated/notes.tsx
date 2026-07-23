import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { ComingSoon } from "./lectures";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — ALIP" }, { name: "description", content: "Structured AI-generated notes." }] }),
  component: () => <ComingSoon title="Notes" description="Executive summaries, key concepts, formulas, and action items." icon={BookOpen} />,
});

import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ComingSoon } from "./lectures";

export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () => ({ meta: [{ title: "Flashcards — ALIP" }, { name: "description", content: "Spaced-repetition decks generated from your lectures." }] }),
  component: () => <ComingSoon title="Flashcards" description="Spaced-repetition decks generated from your own lectures." icon={Sparkles} />,
});

import { Loader2, Sparkles, RefreshCcw, BookOpen, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import jsPDF from "jspdf";

type Notes = {
  summary: string | null;
  eli5: string | null;
  key_points: unknown;
  glossary: unknown;
  generated_at: string | null;
} | null | undefined;

export function NotesPanel({
  notes,
  loading,
  onGenerate,
  generating,
  hasTranscript,
}: {
  notes: Notes;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  hasTranscript: boolean;
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = () => {
    if (!notes) return;
    
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF();
      let yPos = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;

      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Lecture Notes", margin, yPos);
      yPos += 15;

      // ELI5
      if (notes.eli5) {
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Explain like I'm 12", margin, yPos);
        yPos += 7;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const eli5Lines = pdf.splitTextToSize(notes.eli5, maxWidth);
        pdf.text(eli5Lines, margin, yPos);
        yPos += eli5Lines.length * 5 + 10;
      }

      // Summary
      if (notes.summary) {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Summary", margin, yPos);
        yPos += 7;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const summaryLines = pdf.splitTextToSize(notes.summary, maxWidth);
        pdf.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 5 + 10;
      }

      // Key Points
      const keyPoints = Array.isArray(notes.key_points) ? (notes.key_points as string[]) : [];
      if (keyPoints.length > 0) {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Key Points", margin, yPos);
        yPos += 7;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        keyPoints.forEach((point) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          const pointLines = pdf.splitTextToSize(`• ${point}`, maxWidth);
          pdf.text(pointLines, margin, yPos);
          yPos += pointLines.length * 5 + 3;
        });
        yPos += 7;
      }

      // Glossary
      const glossary = Array.isArray(notes.glossary)
        ? (notes.glossary as Array<{ term: string; definition: string }>)
        : [];
      if (glossary.length > 0) {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Glossary", margin, yPos);
        yPos += 7;
        glossary.forEach((item) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.text(item.term, margin, yPos);
          yPos += 5;
          pdf.setFont("helvetica", "normal");
          const defLines = pdf.splitTextToSize(item.definition, maxWidth);
          pdf.text(defLines, margin, yPos);
          yPos += defLines.length * 5 + 5;
        });
      }

      pdf.save(`lecture-notes-${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setDownloadingPdf(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card/40 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!notes) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <p className="text-base font-semibold">No notes yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Generate an AI summary, easy-terms explanation, key points, and glossary from the transcript.
        </p>
        <Button
          className="mt-5"
          size="sm"
          onClick={onGenerate}
          disabled={!hasTranscript || generating}
        >
          {generating ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-3.5 w-3.5" />
          )}
          {generating ? "Generating…" : "Generate notes"}
        </Button>
      </div>
    );
  }

  const keyPoints = Array.isArray(notes.key_points) ? (notes.key_points as string[]) : [];
  const glossary = Array.isArray(notes.glossary)
    ? (notes.glossary as Array<{ term: string; definition: string }>)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Generated {notes.generated_at ? new Date(notes.generated_at).toLocaleString() : ""}
        </p>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-3.5 w-3.5" />
            )}
            {downloadingPdf ? "Generating PDF…" : "Download PDF"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      </div>

      {notes.eli5 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Explain like I'm 12
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{notes.eli5}</p>
        </div>
      )}

      {notes.summary && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {notes.summary}
          </p>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Key points
          </p>
          <ul className="space-y-2">
            {keyPoints.map((k, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span className="text-foreground/90">{k}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {glossary.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Glossary
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {glossary.map((g, i) => (
              <div key={i} className="rounded-lg bg-muted/30 p-3">
                <dt className="text-sm font-semibold text-foreground">{g.term}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">{g.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

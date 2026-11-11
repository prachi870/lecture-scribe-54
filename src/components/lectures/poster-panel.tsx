import { Loader2, Sparkles, RefreshCcw, Image as ImageIcon, Download, ArrowRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Poster = {
  image_url: string | null;
  title: string | null;
  description: string | null;
  concepts: unknown;
  flow_steps: unknown;
  diagram_type: string | null;
  generated_at: string | null;
} | null | undefined;

export function PosterPanel({
  poster,
  loading,
  onGenerate,
  generating,
  onGenerateImage,
  generatingImage,
  hasTranscript,
}: {
  poster: Poster;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  onGenerateImage: () => void;
  generatingImage: boolean;
  hasTranscript: boolean;
}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!posterRef.current) return;
    
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`lecture-poster-${Date.now()}.pdf`);
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

  if (!poster) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <ImageIcon className="h-5 w-5" />
        </div>
        <p className="text-base font-semibold">No poster yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Generate a visual concept poster with diagrams and flows to help you remember key points.
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
          {generating ? "Generating…" : "Generate poster"}
        </Button>
      </div>
    );
  }

  const concepts = Array.isArray(poster.concepts) 
    ? (poster.concepts as Array<{ title: string; description: string; icon?: string }>) 
    : [];

  const flowSteps = Array.isArray(poster.flow_steps)
    ? (poster.flow_steps as Array<{ step: number; title: string; description: string }>)
    : [];

  const handleDownload = () => {
    if (poster.image_url) {
      const link = document.createElement('a');
      link.href = poster.image_url;
      link.download = `lecture-poster-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Generated {poster.generated_at ? new Date(poster.generated_at).toLocaleString() : ""}
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
          {poster.image_url && (
            <Button size="sm" variant="ghost" onClick={handleDownload}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Download Image
            </Button>
          )}
          {!poster.image_url && (
            <Button 
              size="sm" 
              variant="default" 
              onClick={onGenerateImage} 
              disabled={generatingImage}
            >
              {generatingImage ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-3.5 w-3.5" />
              )}
              {generatingImage ? "Generating Image…" : "Generate AI Image"}
            </Button>
          )}
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

      {/* Enhanced Visual Poster Design */}
      <div ref={posterRef} className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-8">
        {/* Decorative background patterns */}
        <div className="absolute inset-0 opacity-5">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Header */}
        {poster.title && (
          <div className="relative mb-6 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Lecture Concept
              </span>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {poster.title}
            </h2>
            {poster.description && (
              <p className="mt-3 text-base text-muted-foreground max-w-2xl mx-auto">
                {poster.description}
              </p>
            )}
          </div>
        )}

        {/* AI Generated Image (if available) */}
        {poster.image_url && (
          <div className="relative mb-6 overflow-hidden rounded-xl border-2 border-border/60 bg-card shadow-xl">
            <img 
              src={poster.image_url} 
              alt="AI Generated Lecture Poster" 
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Process Flow with Visual Connection */}
      {flowSteps.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-primary to-primary/50" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Process Flow
            </h3>
            <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-primary/50 to-transparent" />
          </div>
          <div className="space-y-4">
            {flowSteps.map((step, i) => (
              <div key={i} className="group relative">
                <div className="flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-lg font-bold text-primary-foreground shadow-lg ring-4 ring-primary/10 transition-transform group-hover:scale-110">
                      {step.step}
                    </div>
                    {i < flowSteps.length - 1 && (
                      <div className="w-0.5 flex-1 my-2 bg-gradient-to-b from-primary/60 to-primary/20" style={{ minHeight: '20px' }} />
                    )}
                  </div>
                  <div className="flex-1 rounded-xl border border-border/40 bg-muted/20 p-4 transition-all group-hover:border-primary/40 group-hover:bg-muted/40">
                    <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                      {step.title}
                      <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Concepts with Enhanced Cards */}
      {concepts.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-primary to-primary/50" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Key Concepts
            </h3>
            <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-primary/50 to-transparent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {concepts.map((concept, i) => (
              <div 
                key={i} 
                className="group relative overflow-hidden rounded-xl border-2 border-border/40 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/5 transition-transform group-hover:scale-150" />
                <div className="relative flex items-start gap-4">
                  {concept.icon && (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-3xl ring-2 ring-primary/20 transition-transform group-hover:scale-110">
                      {concept.icon}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-foreground">
                      {concept.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {concept.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

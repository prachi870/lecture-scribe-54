import { Loader2, Sparkles, RefreshCcw, Image as ImageIcon, Download, ArrowRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import jsPDF from "jspdf";

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!poster) {
      console.log('No poster data found');
      return;
    }
    
    setDownloadingPdf(true);
    try {
      console.log('Starting PDF generation...');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const margin = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const maxWidth = pageWidth - 2 * margin;
      let yPos = 20;
      
      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      if (poster.title) {
        const titleLines = pdf.splitTextToSize(poster.title, maxWidth);
        pdf.text(titleLines, margin, yPos);
        yPos += titleLines.length * 8 + 10;
      }
      
      // Description
      if (poster.description) {
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        const descLines = pdf.splitTextToSize(poster.description, maxWidth);
        pdf.text(descLines, margin, yPos);
        yPos += descLines.length * 6 + 15;
      }
      
      // Flow Steps
      const flowSteps = Array.isArray(poster.flow_steps)
        ? (poster.flow_steps as Array<{ step: number; title: string; description: string }>)
        : [];
        
      if (flowSteps.length > 0) {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Process Flow", margin, yPos);
        yPos += 10;
        
        flowSteps.forEach((step) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${step.step}. ${step.title}`, margin, yPos);
          yPos += 6;
          
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const stepLines = pdf.splitTextToSize(step.description, maxWidth);
          pdf.text(stepLines, margin, yPos);
          yPos += stepLines.length * 5 + 8;
        });
        
        yPos += 5;
      }
      
      // Key Concepts
      const concepts = Array.isArray(poster.concepts) 
        ? (poster.concepts as Array<{ title: string; description: string; icon?: string }>) 
        : [];
        
      if (concepts.length > 0) {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Key Concepts", margin, yPos);
        yPos += 10;
        
        concepts.forEach((concept) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          const conceptTitle = concept.icon ? `${concept.icon} ${concept.title}` : concept.title;
          pdf.text(conceptTitle, margin, yPos);
          yPos += 6;
          
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const conceptLines = pdf.splitTextToSize(concept.description, maxWidth);
          pdf.text(conceptLines, margin, yPos);
          yPos += conceptLines.length * 5 + 8;
        });
      }
      
      console.log('Saving PDF...');
      pdf.save(`lecture-poster-${Date.now()}.pdf`);
      console.log('PDF saved successfully!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    console.log('Download button clicked');
    console.log('Image URL:', poster.image_url);
    
    if (!poster.image_url) {
      console.log('No image URL found');
      return;
    }
    
    try {
      // If it's a base64 data URL, we need to handle it differently
      if (poster.image_url.startsWith('data:')) {
        console.log('Downloading base64 image...');
        const link = document.createElement('a');
        link.href = poster.image_url;
        link.download = `lecture-poster-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Download triggered');
      } else {
        console.log('Fetching remote image...');
        // Regular URL
        fetch(poster.image_url)
          .then(res => {
            console.log('Fetch response:', res.status);
            return res.blob();
          })
          .then(blob => {
            console.log('Blob received, size:', blob.size);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `lecture-poster-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log('Download completed');
          })
          .catch(err => {
            console.error('Fetch error:', err);
            alert(`Failed to download image: ${err.message}`);
          });
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-8">
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

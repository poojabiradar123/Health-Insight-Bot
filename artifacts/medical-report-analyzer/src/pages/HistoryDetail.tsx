import { useGetAnalysisById, getGetAnalysisByIdQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { AnalysisResultDisplay } from "./Home";
import { generateReportPDF } from "@/lib/pdfGenerator";

export default function HistoryDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: result, isLoading, error } = useGetAnalysisById(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisByIdQueryKey(id) }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <span>Loading analysis record...</span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Failed to load analysis details. The record might not exist.
        </div>
        <Link href="/history">
          <Button variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" /> Back to History
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/history">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Record Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analysis #{result.id} • {result.createdAt ? new Date(result.createdAt).toLocaleString() : 'Unknown date'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => generateReportPDF(result)}>
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div className="bg-card p-6 rounded-xl border shadow-sm">
        <AnalysisResultDisplay result={result} showDownload={false} />
      </div>
    </div>
  );
}

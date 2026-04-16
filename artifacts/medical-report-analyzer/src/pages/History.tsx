import { useGetAnalysisHistory, useGetAnalysisById, getGetAnalysisByIdQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ActivitySquare, Download } from "lucide-react";
import { getRiskColor, getUrgencyColor, getValidationColor } from "./Home";
import { generateReportPDF } from "@/lib/pdfGenerator";

function DownloadButton({ id }: { id: number }) {
  const { refetch, isFetching } = useGetAnalysisById(id, {
    query: { enabled: false, queryKey: getGetAnalysisByIdQueryKey(id) }
  });

  async function handleDownload() {
    const { data } = await refetch();
    if (data) {
      generateReportPDF(data);
    }
  }

  return (
    <Button variant="ghost" size="sm" className="h-8" onClick={handleDownload} disabled={isFetching}>
      {isFetching ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Download className="w-3 h-3" />
      )}
    </Button>
  );
}

export default function History() {
  const { data: history, isLoading, error } = useGetAnalysisHistory();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center">
        Failed to load analysis history. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
        <p className="text-muted-foreground mt-2">
          View and download past clinical report analyses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Records</CardTitle>
          <CardDescription>
            {history?.length || 0} analyses recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history?.length === 0 ? (
            <div className="text-center py-10">
              <ActivitySquare className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground">No analysis history found.</p>
              <Link href="/">
                <Button variant="outline" className="mt-4">Run First Analysis</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead>Abnormal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.map((item) => (
                  <TableRow key={item.id} data-testid={`history-row-${item.id}`}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(item.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.patientName || <span className="text-muted-foreground italic">Anonymous</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRiskColor(item.risk_level)}>
                        {item.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getUrgencyColor(item.urgency)}>
                        {item.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{Math.round((item.completeness_score ?? 0) * 100)}%</span>
                    </TableCell>
                    <TableCell>
                      {item.abnormal_count > 0 ? (
                        <span className="font-bold text-red-600">{item.abnormal_count}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getValidationColor(item.validation_status)}>
                        {item.validation_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DownloadButton id={item.id} />
                        <Link href={`/history/${item.id}`} className="inline-block">
                          <Button variant="ghost" size="sm" className="h-8" data-testid={`btn-view-${item.id}`}>
                            View <ArrowRight className="ml-2 w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

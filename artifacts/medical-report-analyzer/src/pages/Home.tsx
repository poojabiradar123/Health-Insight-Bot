import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAnalyzeReport, getGetAnalysisHistoryQueryKey } from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { generateReportPDF } from "@/lib/pdfGenerator";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, AlertCircle, CheckCircle2, Info, Activity, ArrowRight,
  Download, AlertTriangle, Siren, ShieldCheck, BarChart2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  patientName: z.string().optional(),
  hemoglobin: z.coerce.number().positive("Must be positive").optional(),
  wbc: z.coerce.number().positive("Must be positive").optional(),
  glucose: z.coerce.number().positive("Must be positive").optional(),
  vitaminD: z.coerce.number().positive("Must be positive").optional(),
  cholesterol: z.coerce.number().positive("Must be positive").optional(),
  platelets: z.coerce.number().positive("Must be positive").optional(),
  doctorRemarks: z.string().optional(),
}).refine(data =>
  data.hemoglobin !== undefined ||
  data.wbc !== undefined ||
  data.glucose !== undefined ||
  data.vitaminD !== undefined ||
  data.cholesterol !== undefined ||
  data.platelets !== undefined,
  {
    message: "At least one lab value must be provided for analysis.",
    path: ["root"]
  }
);

export function getRiskColor(level: string) {
  switch (level?.toLowerCase()) {
    case "low": return "bg-green-500/10 text-green-700 border-green-500/20";
    case "moderate": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "high": return "bg-red-500/10 text-red-700 border-red-500/20";
    default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
}

export function getUrgencyColor(urgency: string) {
  switch (urgency?.toLowerCase()) {
    case "routine": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "soon": return "bg-orange-500/10 text-orange-700 border-orange-500/20";
    case "immediate": return "bg-red-500/10 text-red-700 border-red-500/20";
    default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
}

export function getValidationColor(status: string) {
  switch (status?.toLowerCase()) {
    case "clinically verified": return "bg-green-500/10 text-green-700 border-green-500/20";
    case "invalid data": return "bg-red-500/10 text-red-700 border-red-500/20";
    case "insufficient data": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
}

function getSeverityBadgeClass(sev: unknown): string {
  const severity = sev as string;
  if (!severity) return "bg-gray-100 text-gray-700";
  if (severity === "Normal") return "bg-green-100 text-green-700";
  if (severity.includes("Severely") || severity === "Deficiency") return "bg-red-100 text-red-700";
  if (severity.includes("High") || severity.includes("Low") || severity.includes("Borderline")) return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

function getSeverityIcon(sev: unknown) {
  const severity = sev as string;
  if (!severity || severity === "Normal") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
  if (severity.includes("Severely") || severity === "Deficiency") return <Siren className="w-3.5 h-3.5 text-red-600" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
}

function getUrgencyIcon(urgency: string) {
  if (urgency?.toLowerCase() === "immediate") return <Siren className="w-4 h-4 text-red-600" />;
  if (urgency?.toLowerCase() === "soon") return <AlertTriangle className="w-4 h-4 text-orange-500" />;
  return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
}

function ParameterCharts({ result }: { result: AnalysisResult }) {
  const breakdown = result.severity_breakdown || {};
  const params = Object.entries(breakdown).filter(([, v]) => v != null);

  const normalCount = params.filter(([, v]) => v === "Normal").length;
  const abnormalCount = params.length - normalCount;

  const pieData = [
    { name: "Normal", value: normalCount, color: "#16a34a" },
    { name: "Abnormal", value: abnormalCount, color: "#dc2626" },
  ].filter((d) => d.value > 0);

  const severityScore: Record<string, number> = {
    Normal: 0,
    "Borderline Low": 1,
    "Borderline High": 1,
    Low: 2,
    High: 2,
    Deficiency: 2,
    "Severely Low": 3,
    "Severely High": 3,
  };

  const barData = params.map(([key, sev]) => {
    const severity = sev as string;
    return {
      name: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      score: severityScore[severity] ?? 0,
      severity,
      fill: severity === "Normal" ? "#16a34a" : (severity?.includes("Severely") || severity === "Deficiency") ? "#dc2626" : "#d97706",
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Normal vs Abnormal
          </CardTitle>
          <CardDescription>{params.length} parameters analyzed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-44 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} parameter(s)`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">No chart data</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Parameter Severity
          </CardTitle>
          <CardDescription>0 = Normal, 1 = Borderline, 2 = Abnormal, 3 = Critical</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={36} />
                <YAxis ticks={[0, 1, 2, 3]} tick={{ fontSize: 9 }} domain={[0, 3]} />
                <Tooltip
                  formatter={(_: number, __: string, props: any) => [props.payload.severity, "Severity"]}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalysisResultDisplay({
  result,
  showDownload = false,
}: {
  result: AnalysisResult;
  showDownload?: boolean;
}) {
  if (!result) return null;

  const completenessPercent = Math.round((result.completeness_score ?? 0) * 100);
  const urgencyLower = result.urgency?.toLowerCase();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analysis Results</h2>
          {result.patientName && (
            <p className="text-muted-foreground mt-1">Patient: <span className="font-medium">{result.patientName}</span></p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="outline" className={getValidationColor(result.validation_status)}>
            <ShieldCheck className="w-3 h-3 mr-1" />
            {result.validation_status}
          </Badge>
          <Badge variant="outline" className={getRiskColor(result.risk_level)}>
            Risk: {result.risk_level}
          </Badge>
          <Badge variant="outline" className={`flex items-center gap-1 ${getUrgencyColor(result.urgency)}`}>
            {getUrgencyIcon(result.urgency)}
            {result.urgency}
          </Badge>
          {showDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateReportPDF(result)}
              className="ml-2"
            >
              <Download className="w-4 h-4 mr-1" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {urgencyLower === "immediate" && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          <Siren className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            🚨 IMMEDIATE attention required — critical findings detected. Consult a physician urgently.
          </p>
        </div>
      )}
      {urgencyLower === "soon" && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            ⚠️ Follow-up recommended soon — schedule a medical consultation within the week.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground font-normal">Confidence Score</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{(result.confidence * 100).toFixed(0)}%</p>
            <Progress value={result.confidence * 100} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{result.confidence_reason}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground font-normal">Data Completeness</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{completenessPercent}%</p>
            <Progress value={completenessPercent} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((result.completeness_score ?? 0) * 6)} of 6 parameters provided
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground font-normal">Abnormalities</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{result.abnormal_count}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {result.abnormal_count === 0
                ? "All parameters within normal range"
                : result.abnormal_count === 1
                ? "1 parameter outside normal range"
                : `${result.abnormal_count} parameters outside normal range`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Clinical Explanation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.explanation}</p>
        </CardContent>
      </Card>

      <ParameterCharts result={result} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Parameter Severity Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(result.severity_breakdown || {}).map(([key, sev]) => {
                const severity = sev as string;
                if (!severity) return null;
                const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c: string) => c.toUpperCase());
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`flex w-fit items-center gap-1.5 ${getSeverityBadgeClass(severity)}`}>
                        {getSeverityIcon(severity)}
                        <span>{severity}</span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(result.disease_risks?.length > 0 || result.clinical_insights?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {result.disease_risks?.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  Identified Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(result.disease_risks as string[]).map((risk: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 shrink-0">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.clinical_insights?.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                  <Info className="w-4 h-4" />
                  Clinical Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(result.clinical_insights as string[]).map((insight: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {result.recommendations?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {(result.recommendations as string[]).map((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2 bg-muted/50 p-3 rounded-md">
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Separator />
      <p className="text-xs text-muted-foreground text-center">
        This analysis is generated by an automated system and must be reviewed by a licensed medical professional before any clinical decisions are made.
      </p>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const analyzeMutation = useAnalyzeReport();
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: "",
      hemoglobin: undefined,
      wbc: undefined,
      glucose: undefined,
      vitaminD: undefined,
      cholesterol: undefined,
      platelets: undefined,
      doctorRemarks: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setResult(null);
    analyzeMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setResult(data);
          queryClient.invalidateQueries({ queryKey: getGetAnalysisHistoryQueryKey() });
          toast({
            title: "Analysis Complete",
            description: "The medical report has been successfully analyzed.",
          });
        },
        onError: (error: any) => {
          toast({
            title: "Analysis Failed",
            description: error?.data?.error || error?.message || "An error occurred during analysis.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Analysis</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Enter clinical lab parameters to generate a comprehensive medical insight report.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={result ? "lg:col-span-4 transition-all duration-500" : "lg:col-span-12 transition-all duration-500"}>
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle>Lab Parameters</CardTitle>
              <CardDescription>Leave unknown fields blank. At least one value is required. All values must be positive.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {form.formState.errors.root && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {form.formState.errors.root.message}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="patientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient Name / ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. John Doe (Optional)" {...field} value={field.value ?? ""} data-testid="input-patient-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hemoglobin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hemoglobin (g/dL)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="0" placeholder="12.0 - 17.5" {...field} value={field.value ?? ""} data-testid="input-hemoglobin" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="wbc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WBC (cells/µL)</FormLabel>
                          <FormControl>
                            <Input type="number" step="1" min="0" placeholder="4500 - 11000" {...field} value={field.value ?? ""} data-testid="input-wbc" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="glucose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Glucose (mg/dL)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="0" placeholder="70 - 99" {...field} value={field.value ?? ""} data-testid="input-glucose" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vitaminD"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vitamin D (ng/mL)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="0" placeholder="20 - 50" {...field} value={field.value ?? ""} data-testid="input-vitamin-d" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cholesterol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cholesterol (mg/dL)</FormLabel>
                          <FormControl>
                            <Input type="number" step="1" min="0" placeholder="< 200" {...field} value={field.value ?? ""} data-testid="input-cholesterol" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="platelets"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platelets (cells/µL)</FormLabel>
                          <FormControl>
                            <Input type="number" step="1000" min="0" placeholder="150000 - 450000" {...field} value={field.value ?? ""} data-testid="input-platelets" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="doctorRemarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinical Remarks (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any contextual notes or symptoms..."
                            className="resize-none"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-doctor-remarks"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={analyzeMutation.isPending}
                    data-testid="btn-analyze"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Data...
                      </>
                    ) : (
                      "Run Clinical Analysis"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {result && (
          <div className="lg:col-span-8">
            <AnalysisResultDisplay result={result} showDownload />
          </div>
        )}
      </div>
    </div>
  );
}

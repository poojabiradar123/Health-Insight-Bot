import jsPDF from "jspdf";
import type { AnalysisResult } from "@workspace/api-client-react";

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function sectionHeader(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(37, 99, 235);
  doc.rect(14, y - 5, 182, 8, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(text, 17, y);
  doc.setTextColor(30, 30, 30);
  return y + 8;
}

function checkPage(doc: jsPDF, y: number, margin = 20): number {
  if (y > 270) {
    doc.addPage();
    return margin;
  }
  return y;
}

export function generateReportPDF(result: AnalysisResult): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Clinical Medical Report", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 22);
  doc.setTextColor(30, 30, 30);

  y = 40;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (result.patientName) {
    doc.text(`Patient: ${result.patientName}`, margin, y);
    y += 7;
  }

  const riskColors: Record<string, [number, number, number]> = {
    Low: [22, 163, 74],
    Moderate: [217, 119, 6],
    High: [220, 38, 38],
  };
  const urgencyColors: Record<string, [number, number, number]> = {
    Routine: [59, 130, 246],
    Soon: [249, 115, 22],
    Immediate: [220, 38, 38],
  };

  const riskColor = riskColors[result.risk_level] ?? [100, 100, 100];
  const urgencyColor = urgencyColors[result.urgency] ?? [100, 100, 100];

  doc.setFillColor(...riskColor);
  doc.roundedRect(margin, y, 55, 10, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`Risk: ${result.risk_level}`, margin + 4, y + 6.5);

  doc.setFillColor(...urgencyColor);
  doc.roundedRect(margin + 60, y, 60, 10, 2, 2, "F");
  doc.text(`Urgency: ${result.urgency}`, margin + 64, y + 6.5);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  y += 16;

  doc.text(`Confidence: ${(result.confidence * 100).toFixed(0)}%   |   Data Completeness: ${(result.completeness_score * 100).toFixed(0)}%   |   Abnormal Parameters: ${result.abnormal_count}`, margin, y);
  y += 5;
  doc.text(`Validation: ${result.validation_status}`, margin, y);
  y += 12;

  y = sectionHeader(doc, "CLINICAL EXPLANATION", y);
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  y = addWrappedText(doc, result.explanation || "N/A", margin, y, contentWidth, 5);
  y += 8;

  y = checkPage(doc, y);
  y = sectionHeader(doc, "SEVERITY BREAKDOWN", y);
  y += 4;

  const params = Object.entries(result.severity_breakdown || {}).filter(([, v]) => v != null);
  params.forEach(([key, severity]) => {
    y = checkPage(doc, y);
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin + 2, y);
    doc.setFont("helvetica", "normal");

    const sevStr = severity as string;
    if (sevStr === "Normal") {
      doc.setTextColor(22, 163, 74);
    } else if (sevStr.includes("Severely") || sevStr.includes("Deficiency")) {
      doc.setTextColor(220, 38, 38);
    } else {
      doc.setTextColor(217, 119, 6);
    }
    doc.text(sevStr, margin + 45, y);
    doc.setTextColor(30, 30, 30);
    y += 6;
  });
  y += 4;

  if (result.disease_risks && result.disease_risks.length > 0) {
    y = checkPage(doc, y);
    y = sectionHeader(doc, "IDENTIFIED RISKS", y);
    y += 4;
    (result.disease_risks as string[]).forEach((risk: string) => {
      y = checkPage(doc, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      y = addWrappedText(doc, `\u2022 ${risk}`, margin + 2, y, contentWidth - 4, 5);
      y += 2;
    });
    y += 4;
  }

  if (result.clinical_insights && result.clinical_insights.length > 0) {
    y = checkPage(doc, y);
    y = sectionHeader(doc, "CLINICAL INSIGHTS", y);
    y += 4;
    (result.clinical_insights as string[]).forEach((insight: string) => {
      y = checkPage(doc, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      y = addWrappedText(doc, `\u2022 ${insight}`, margin + 2, y, contentWidth - 4, 5);
      y += 2;
    });
    y += 4;
  }

  if (result.recommendations && result.recommendations.length > 0) {
    y = checkPage(doc, y);
    y = sectionHeader(doc, "RECOMMENDATIONS", y);
    y += 4;
    (result.recommendations as string[]).forEach((rec: string, i: number) => {
      y = checkPage(doc, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      y = addWrappedText(doc, `${i + 1}. ${rec}`, margin + 2, y, contentWidth - 4, 5);
      y += 2;
    });
    y += 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "italic");
  const disclaimer = "DISCLAIMER: This report is generated by an automated clinical analysis system. It is intended for informational purposes only and must be reviewed by a licensed medical professional before any clinical decisions are made.";
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addWrappedText(doc, disclaimer, margin, 283, contentWidth, 4);
  }

  const patientSlug = result.patientName ? result.patientName.replace(/\s+/g, "_") : "anonymous";
  doc.save(`clinical_report_${patientSlug}_${Date.now()}.pdf`);
}

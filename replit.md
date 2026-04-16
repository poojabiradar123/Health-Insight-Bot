# Clinical Medical Report Analysis System

## Overview

A production-ready, clinically reliable medical report analysis web application with a hybrid rule-based + LLM architecture. All clinical decisions are made deterministically — the LLM only generates plain-English explanations. Protected by login authentication.

## Login Credentials

- **Username**: `admin`
- **Password**: `clinical123`
- Overridable via `ADMIN_USERNAME` / `ADMIN_PASSWORD` environment variables

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + express-session
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + recharts + jsPDF
- **LLM**: OpenAI gpt-4o-mini via Replit AI Integrations (explanation only, no decision-making)

## Architecture

```
Input
↓
Auth Check (session-based login required)
↓
Data Validation (negative value check, clinical sanity checks)
↓
Severity Engine (rule-based per parameter)
↓
Risk Scoring (severity + count based)
↓
Urgency Consistency (High→Immediate, Moderate→Soon, Low→Routine — enforced)
↓
Disease Risk Mapping (deterministic)
↓
Correlation Logic (multi-parameter insights)
↓
LLM (explanation text only, strict system prompt, never classifies)
↓
Completeness Score (provided_params / 6)
↓
Output (structured JSON + saved to DB)
```

## Features

1. **Login System** — Session-based auth gate; all analysis routes protected server-side
2. **PDF Download** — Client-side jsPDF generation with colored risk badges, severity table, insights, recommendations, disclaimer
3. **Per-Analysis Charts** — Recharts pie chart (Normal vs Abnormal) + bar chart (severity score per parameter)
4. **Data Completeness Score** — Shows what % of the 6 lab parameters were provided; affects confidence display
5. **Input Validation** — No negative values allowed; WBC/platelet unit sanity checks; at least 1 value required
6. **Urgency Consistency** — High Risk always maps to Immediate; Moderate → Soon; Low → Routine (enforced in API)
7. **LLM Safety** — System prompt explicitly forbids reinterpreting values, introducing new diseases, or exaggerating
8. **History PDF Download** — Each past analysis can be downloaded as PDF from history table
9. **Urgency Alert Banners** — Red emergency banner for Immediate urgency, amber warning for Soon
10. **Color Severity Icons** — Green check, amber warning, red siren per parameter

## Key Files

- `artifacts/api-server/src/lib/clinicalEngine.ts` — Complete deterministic rule-based clinical engine
- `artifacts/api-server/src/routes/analysis/index.ts` — API routes: analyze, history, stats. Includes completeness + urgency consistency
- `artifacts/api-server/src/routes/auth/index.ts` — Login/logout/me auth routes
- `artifacts/api-server/src/app.ts` — Express app with express-session
- `lib/db/src/schema/analyses.ts` — Database schema (includes completeness_score column)
- `artifacts/medical-report-analyzer/src/pages/Home.tsx` — Analysis form + full results display with charts
- `artifacts/medical-report-analyzer/src/pages/History.tsx` — History table with per-row PDF download
- `artifacts/medical-report-analyzer/src/pages/HistoryDetail.tsx` — Full analysis view with PDF download
- `artifacts/medical-report-analyzer/src/pages/Login.tsx` — Login page
- `artifacts/medical-report-analyzer/src/contexts/AuthContext.tsx` — Auth state management
- `artifacts/medical-report-analyzer/src/lib/pdfGenerator.ts` — jsPDF report generation
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)

## Clinical Rules

**Severity:**
- Hemoglobin: <10 Severely Low, 10-12 Low, 12-13.5 Borderline Low
- WBC: >20000 Severely High, >11000 High, <4000 Low
- Glucose: ≥200 Severely High, 126-199 High, 100-125 Prediabetes
- Vitamin D: <20 Deficiency
- Cholesterol: >240 High, 200-240 Borderline High
- Platelets: <100000 Severely Low, <150000 Low

**Risk Scoring:** Count-based + severity overrides (Severe → always High)
**Urgency Consistency:** High → Immediate, Moderate → Soon, Low → Routine
**Confidence Calibration:** 0.9 (severe) → 0.6 (minimal data), further adjusted by completeness score
**Correlation Logic:** High WBC+Low Hb → infection+anemia, High glucose+cholesterol → metabolic risk

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (also fixes barrel file)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- `artifacts/medical-report-analyzer` — React+Vite frontend (previewPath: `/`)
- `artifacts/api-server` — Express API server (previewPath: `/api`)

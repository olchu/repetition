import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForAdmin } from "@/lib/attempt-review";
import { buildAttemptReport, reportDownload } from "@/lib/result-report";

type RouteContext = { params: Promise<{ attemptId: string }> };

/** One attempt as a downloadable JSON report; see docs/RESULT-REPORT.md. */
export async function GET(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const attempt = await findAttemptForAdmin((await context.params).attemptId);

  if (!attempt) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Attempt not found." } },
      { status: 404 },
    );
  }

  const test = attempt.assignment.test;
  const day = (attempt.submittedAt ?? attempt.startedAt).toISOString().slice(0, 10);
  return reportDownload(buildAttemptReport(attempt), `result-${attempt.child.login}-${test.stableId}-v${test.version}-${day}`);
}

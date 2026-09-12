import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findSubmittedAttemptsForTest } from "@/lib/attempt-review";
import { buildTestHistoryReport, reportDownload } from "@/lib/result-report";

/**
 * All submitted attempts of one test (every version of `stableId`) by one
 * child, as a downloadable JSON report; see docs/RESULT-REPORT.md.
 */
export async function GET(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const params = new URL(request.url).searchParams;
  const childId = params.get("childId") ?? "";
  const stableId = params.get("stableId") ?? "";

  if (!childId || !stableId) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "childId and stableId are required." } },
      { status: 400 },
    );
  }

  const attempts = await findSubmittedAttemptsForTest(childId, stableId);

  if (attempts.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "This child has no submitted attempts of this test." } },
      { status: 404 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return reportDownload(buildTestHistoryReport(attempts), `results-${attempts[0].child.login}-${stableId}-all-attempts-${today}`);
}

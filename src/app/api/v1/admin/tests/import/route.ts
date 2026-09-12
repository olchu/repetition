import { NextResponse } from "next/server";
import { createTestDraft, validateTestDocument, UnknownSubjectError } from "@/lib/tests";
import { getCurrentUser } from "@/lib/auth";

const MAX_IMPORT_BYTES = 1_000_000;

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "FILE_REQUIRED", message: "Attach a JSON file as `file`." } },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: { code: "FILE_TOO_LARGE", message: "JSON files must be smaller than 1 MB." } },
      { status: 413 },
    );
  }

  let input: unknown;

  try {
    input = JSON.parse(await file.text()) as unknown;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "The selected file is not valid JSON.",
          details: [{ path: "$", code: "PARSE_ERROR", message: "Could not parse JSON." }],
        },
      },
      { status: 422 },
    );
  }

  const validation = validateTestDocument(input);

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The test contains validation errors.",
          details: validation.errors,
        },
      },
      { status: 422 },
    );
  }

  let test;
  try {
    test = await createTestDraft(validation.value);
  } catch (error) {
    if (error instanceof UnknownSubjectError) return NextResponse.json({ error: { code: "UNKNOWN_SUBJECT", message: error.message } }, { status: 422 });
    throw error;
  }

  return NextResponse.json(
    {
      test: {
        id: test.id,
        stableId: test.stableId,
        version: test.version,
        title: test.title,
        subject: test.subject.slug,
        status: test.status.toLowerCase(),
        questionCount: test.questionCount,
        passPercentage: test.passPercentage,
      },
    },
    { status: 201 },
  );
}

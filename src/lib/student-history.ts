/** Historical progress includes every submitted test, even after unassignment. */
export type ProgressTest = {
  stableId: string;
  title: string;
  subject: string;
  bestPercentage: number;
  passed: boolean;
};

export type ProgressSummary = {
  completed: number;
  passed: number;
  stars: number;
  subjects: Array<{
    subject: string;
    completed: number;
    passed: number;
    tests: ProgressTest[];
  }>;
};

export type ProgressAttempt = {
  id: string;
  title: string;
  subject: string;
  version: number;
  submittedAt: string;
  earnedPoints: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  archived: boolean;
  unassigned: boolean;
  reward: { kind: "earned" | "training" | "legacy"; stars: number };
};

export type StudentHistory = {
  summary: ProgressSummary;
  attempts: ProgressAttempt[];
  nextCursor: string | null;
};

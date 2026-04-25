/**
 * Calculates a score for a candidate based on job requirements.
 * Returns a score between 0 and 100.
 */
export function calculateScore(
  candidateSkills: string[],
  candidateYOE: number | null,
  jobRequiredSkills: string[] | null,
  jobMinExperience: number | null,
): number {
  let skillScore = 0;
  let experienceScore = 0;

  // 1. Skill Matching (Weight: 70%)
  if (!jobRequiredSkills || jobRequiredSkills.length === 0) {
    skillScore = 100; // No skills required, full score for this part
  } else {
    const requiredSet = new Set(jobRequiredSkills.map((s) => s.toLowerCase()));
    const matchingSkills = candidateSkills.filter((s) =>
      requiredSet.has(s.toLowerCase()),
    );
    skillScore = (matchingSkills.length / jobRequiredSkills.length) * 100;
  }

  // 2. Experience Matching (Weight: 30%)
  if (!jobMinExperience) {
    experienceScore = 100; // No experience required
  } else if (candidateYOE === null) {
    experienceScore = 0; // Required but not found
  } else {
    if (candidateYOE >= jobMinExperience) {
      experienceScore = 100;
    } else {
      experienceScore = (candidateYOE / jobMinExperience) * 100;
    }
  }

  // Final Weighted Score
  const finalScore = Math.round(skillScore * 0.7 + experienceScore * 0.3);
  return Math.min(100, Math.max(0, finalScore));
}

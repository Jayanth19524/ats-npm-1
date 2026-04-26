/**
 * Calculates a score for a candidate based on job requirements.
 * Returns a score between 0 and 100.
 */

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must", "we", "you",
  "our", "your", "their", "this", "that", "these", "those", "it", "its",
  "as", "if", "not", "also", "both", "all", "any", "each", "more", "most",
  "other", "some", "such", "than", "then", "they", "them", "what", "which",
  "who", "whom", "how", "when", "where", "why", "about", "above", "after",
  "before", "between", "during", "into", "through", "under", "while",
]);

/**
 * Extracts meaningful keywords from a block of text.
 * Filters out stop words and short tokens.
 */
export function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

export function calculateScore(
  candidateSkills: string[],
  candidateYOE: number | null,
  jobRequiredSkills: string[] | null,
  jobMinExperience: number | null,
  resumeText?: string,
  jobDescription?: string | null,
): number {
  let skillScore = 0;
  let experienceScore = 0;
  let descriptionScore = 0;

  const hasSkillRequirements = jobRequiredSkills && jobRequiredSkills.length > 0;
  const hasExperienceRequirement = jobMinExperience && jobMinExperience > 0;
  const hasDescription = jobDescription && jobDescription.trim().length > 0;
  const hasResumeText = resumeText && resumeText.trim().length > 0;

  // 1. Skill Matching (Weight: 50% if description available, 60% if not)
  if (!hasSkillRequirements) {
    skillScore = 50; // neutral — no requirements to compare against
  } else {
    const requiredSet = new Set(jobRequiredSkills!.map((s) => s.toLowerCase()));
    const matchingSkills = candidateSkills.filter((s) =>
      requiredSet.has(s.toLowerCase()),
    );
    skillScore = (matchingSkills.length / jobRequiredSkills!.length) * 100;
  }

  // 2. Experience Matching (Weight: 20%)
  if (!hasExperienceRequirement) {
    experienceScore = 50; // neutral — no requirement to compare against
  } else if (candidateYOE === null) {
    experienceScore = 0; // required but not found in resume
  } else {
    if (candidateYOE >= jobMinExperience!) {
      experienceScore = 100;
    } else {
      experienceScore = (candidateYOE / jobMinExperience!) * 100;
    }
  }

  // 3. Job Description Match (Weight: 30% if both available, else redistributed)
  if (hasDescription && hasResumeText) {
    const jobKeywords = extractKeywords(jobDescription!);
    const resumeKeywords = extractKeywords(resumeText!);

    // Remove very common single-char tokens and numbers-only
    const meaningfulJobKeywords = [...jobKeywords].filter(
      (w) => w.length > 3 && !/^\d+$/.test(w),
    );

    if (meaningfulJobKeywords.length === 0) {
      descriptionScore = 50;
    } else {
      const matches = meaningfulJobKeywords.filter((w) =>
        resumeKeywords.has(w),
      );
      descriptionScore = (matches.length / meaningfulJobKeywords.length) * 100;
      // Cap at 100 just in case
      descriptionScore = Math.min(100, descriptionScore);
    }

    // Weights: skills 50%, experience 20%, description 30%
    const finalScore = Math.round(
      skillScore * 0.5 + experienceScore * 0.2 + descriptionScore * 0.3,
    );
    return Math.min(100, Math.max(0, finalScore));
  }

  // No description available — weights: skills 70%, experience 30%
  const finalScore = Math.round(skillScore * 0.7 + experienceScore * 0.3);
  return Math.min(100, Math.max(0, finalScore));
}
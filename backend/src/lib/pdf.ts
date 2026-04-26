import { PDFParse } from "pdf-parse";
import * as fs from "node:fs/promises";

/**
 * Extracts raw text from a PDF file.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  return result.text;
}

/**
 * Basic heuristic to extract years of experience from text.
 */
export function extractYearsOfExperience(text: string): number | null {
  const patterns = [
    /(\d+)\+?\s*years?\s+of\s+experience/i,
    /(\d+)\+?\s*years?\s+exp/i,
    /experience:?\s*(\d+)\+?\s*years?/i,
    /worked\s+for\s+(\d+)\+?\s*years?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  const fallbackMatch = text.match(/(\d+)\+?\s*years?/gi);
  if (fallbackMatch) {
    const years = fallbackMatch.map(m =>
      parseInt(m.match(/\d+/)![0], 10)
    );
    return Math.max(...years);
  }

  return null;
}

/**
 * Basic heuristic to extract skills from text based on a predefined list.
 */
export function extractSkills(text: string, knownSkills: string[]): string[] {
  const foundSkills: string[] = [];
  const lowercaseText = text.toLowerCase();

  for (const skill of knownSkills) {
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedSkill}\\b`, "i");
    if (regex.test(lowercaseText)) {
      foundSkills.push(skill);
    }
  }

  return foundSkills;
}

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
 * Extracts meaningful keywords from text.
 */
export function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(
      (w) =>
        w.length > 3 &&
        !STOP_WORDS.has(w) &&
        !/^\d+$/.test(w)
    );

  return new Set(words);
}
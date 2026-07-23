import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedMatrixResult {
  headers: string[];
  rows: any[][];
  headerRowIdx: number;
}

/**
 * Robustly parses a CSV or Excel file into a 2D matrix,
 * automatically detecting the actual header row even if there are
 * leading metadata or index rows (e.g. "1,2,,,8,7...").
 */
export async function parseFileToMatrix(
  file: File | { name: string; text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer> },
  knownHeaderKeywords: string[] = []
): Promise<ParsedMatrixResult> {
  let matrix: any[][] = [];

  const fileName = file.name || "";
  const isExcel = fileName.toLowerCase().endsWith(".xls") || fileName.toLowerCase().endsWith(".xlsx");

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  } else {
    const fileContent = await file.text();
    const parsed = Papa.parse<any[]>(fileContent, { header: false, skipEmptyLines: true });
    matrix = parsed.data;
  }

  if (!matrix || matrix.length === 0) {
    return { headers: [], rows: [], headerRowIdx: -1 };
  }

  // Default header keywords to search for across ERP exports
  const defaultKeywords = [
    "item code",
    "item name",
    "bill no",
    "product brands",
    "available stock",
    "taxable amount",
    "qty in cld",
    "qty in pcs",
    "customer name",
    "brand name",
    "hsn code",
    "closing stock",
    "days from manufacture",
    "days to expire",
    ...knownHeaderKeywords.map((k) => k.toLowerCase()),
  ];

  let bestRowIdx = 0;
  let maxMatches = 0;

  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const row = matrix[i];
    if (!row || !Array.isArray(row)) continue;
    let matches = 0;
    for (const cell of row) {
      const val = String(cell || "").toLowerCase().trim();
      if (defaultKeywords.some((k) => val.includes(k))) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestRowIdx = i;
    }
  }

  const headers = (matrix[bestRowIdx] || []).map((c) => String(c || "").trim());
  const rows = matrix.slice(bestRowIdx + 1);

  return { headers, rows, headerRowIdx: bestRowIdx };
}

/**
 * Helper to find column index by list of candidate header names (case-insensitive)
 */
export function findColIdx(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase().trim();
    const idx = headers.findIndex((h) => {
      const hLower = h.toLowerCase().trim();
      return hLower === candidateLower || hLower.startsWith(candidateLower);
    });
    if (idx !== -1) return idx;
  }
  return -1;
}

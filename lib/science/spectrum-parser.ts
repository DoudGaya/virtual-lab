export const spectrumLimits = {
  maximumBytes: 5 * 1024 * 1024,
  maximumPoints: 200_000,
  minimumPoints: 3,
} as const;

export type SpectrumPoint = { x: number; y: number };

export type NormalizedSpectrum = {
  format: "CSV" | "JCAMP-DX";
  technique: string;
  title: string;
  xUnit: string;
  yUnit: string;
  points: SpectrumPoint[];
  pointCount: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  axisDirection: "ascending" | "descending" | "mixed";
  warnings: string[];
  sourceMetadata: Record<string, string>;
};

export class SpectrumParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SpectrumParseError";
    this.code = code;
  }
}

function decodeText(bytes: Uint8Array) {
  if (bytes.byteLength === 0) {
    throw new SpectrumParseError("EMPTY_FILE", "The uploaded file is empty.");
  }
  if (bytes.byteLength > spectrumLimits.maximumBytes) {
    throw new SpectrumParseError(
      "FILE_TOO_LARGE",
      "The uploaded file exceeds the 5 MB pilot limit.",
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SpectrumParseError(
      "UNSUPPORTED_ENCODING",
      "The file must use UTF-8 text encoding.",
    );
  }
}

function numericValue(value: string) {
  const number = Number(value.trim().replace(/[dD]/g, "E"));
  return Number.isFinite(number) ? number : null;
}

function unitFromHeader(header: string, fallback: string) {
  const match = header.match(/[[(]([^\])]+)[\])]/);
  const explicit = match?.[1]?.trim();
  if (explicit) return explicit.toLowerCase() === "au" ? "AU" : explicit;
  const suffix = header.trim().match(/(?:_|\/)(nm|au|ppm|hz|khz|mhz|cm\^?-?1|counts?)$/i)?.[1];
  if (!suffix) return fallback;
  if (suffix.toLowerCase() === "au") return "AU";
  if (/^counts?$/i.test(suffix)) return "counts";
  return suffix;
}

function determineTechnique(xUnit: string, yUnit: string, title = "") {
  const context = `${xUnit} ${yUnit} ${title}`.toLowerCase();
  if (context.includes("nm") || context.includes("absorb")) return "UV-Vis";
  if (context.includes("cm-1") || context.includes("cm^-1") || context.includes("infrared")) return "FTIR";
  if (context.includes("ppm") || context.includes("nmr")) return "NMR";
  if (context.includes("m/z") || context.includes("mass spectrum")) return "Mass spectrometry";
  return "Generic spectrum";
}

function summarize(
  base: Omit<NormalizedSpectrum, "pointCount" | "xMin" | "xMax" | "yMin" | "yMax" | "axisDirection">,
  expectedPoints?: number | null,
): NormalizedSpectrum {
  if (base.points.length < spectrumLimits.minimumPoints) {
    throw new SpectrumParseError(
      "INSUFFICIENT_POINTS",
      `A spectrum must contain at least ${spectrumLimits.minimumPoints} numeric points.`,
    );
  }
  if (base.points.length > spectrumLimits.maximumPoints) {
    throw new SpectrumParseError(
      "TOO_MANY_POINTS",
      `The pilot parser accepts at most ${spectrumLimits.maximumPoints.toLocaleString()} points.`,
    );
  }

  let ascending = 0;
  let descending = 0;
  let duplicates = 0;
  for (let index = 1; index < base.points.length; index += 1) {
    const delta = base.points[index].x - base.points[index - 1].x;
    if (delta > 0) ascending += 1;
    else if (delta < 0) descending += 1;
    else duplicates += 1;
  }
  const axisDirection = ascending > 0 && descending > 0
    ? "mixed"
    : descending > 0
      ? "descending"
      : "ascending";

  const warnings = [...base.warnings];
  if (duplicates) warnings.push(`${duplicates} duplicate x-axis position${duplicates === 1 ? " was" : "s were"} detected.`);
  if (axisDirection === "mixed") warnings.push("The x-axis is not monotonic and requires analyst review.");
  if (expectedPoints && expectedPoints !== base.points.length) {
    warnings.push(`The file declares ${expectedPoints} points but ${base.points.length} were parsed.`);
  }

  const xValues = base.points.map((point) => point.x);
  const yValues = base.points.map((point) => point.y);
  return {
    ...base,
    warnings,
    pointCount: base.points.length,
    xMin: Math.min(...xValues),
    xMax: Math.max(...xValues),
    yMin: Math.min(...yValues),
    yMax: Math.max(...yValues),
    axisDirection,
  };
}

function parseCsv(text: string, fileName: string): NormalizedSpectrum {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) {
    throw new SpectrumParseError("EMPTY_FILE", "The CSV file does not contain data.");
  }

  const candidateDelimiters = [",", "\t", ";"];
  const delimiter = candidateDelimiters
    .map((candidate) => ({ candidate, count: lines[0].split(candidate).length }))
    .sort((left, right) => right.count - left.count)[0];
  if (!delimiter || delimiter.count < 2) {
    throw new SpectrumParseError(
      "CSV_COLUMNS_NOT_FOUND",
      "The CSV file must contain at least two comma-, tab-, or semicolon-separated columns.",
    );
  }

  const firstCells = lines[0].split(delimiter.candidate).map((cell) => cell.trim());
  const firstIsNumeric = firstCells.length >= 2 && numericValue(firstCells[0]) !== null && numericValue(firstCells[1]) !== null;
  const headers = firstIsNumeric ? ["x", "y"] : firstCells;
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const xIndex = normalizedHeaders.findIndex((header) => /^(x|wavelength|wavenumber|frequency|raman shift|chemical shift)/.test(header));
  const yIndex = normalizedHeaders.findIndex((header) => /^(y|absorbance|intensity|transmittance|signal|counts)/.test(header));
  const resolvedXIndex = xIndex >= 0 ? xIndex : 0;
  const resolvedYIndex = yIndex >= 0 ? yIndex : 1;
  if (resolvedXIndex === resolvedYIndex || Math.max(resolvedXIndex, resolvedYIndex) >= firstCells.length) {
    throw new SpectrumParseError(
      "CSV_AXIS_COLUMNS_INVALID",
      "The parser could not identify distinct x- and y-axis columns.",
    );
  }

  const warnings: string[] = [];
  if (xIndex < 0 || yIndex < 0) {
    warnings.push("Axis columns were inferred from the first two columns.");
  }
  const points: SpectrumPoint[] = [];
  let skippedRows = 0;
  for (const line of lines.slice(firstIsNumeric ? 0 : 1)) {
    const cells = line.split(delimiter.candidate);
    const x = numericValue(cells[resolvedXIndex] ?? "");
    const y = numericValue(cells[resolvedYIndex] ?? "");
    if (x === null || y === null) {
      skippedRows += 1;
      continue;
    }
    points.push({ x, y });
  }
  if (skippedRows) warnings.push(`${skippedRows} non-numeric row${skippedRows === 1 ? " was" : "s were"} skipped.`);

  const xUnit = unitFromHeader(headers[resolvedXIndex] ?? "", "unknown");
  const yUnit = unitFromHeader(headers[resolvedYIndex] ?? "", "unknown");
  if (xUnit === "unknown" || yUnit === "unknown") warnings.push("One or more axis units are missing and require confirmation.");

  return summarize({
    format: "CSV",
    technique: determineTechnique(xUnit, yUnit, fileName),
    title: fileName.replace(/\.[^.]+$/, ""),
    xUnit,
    yUnit,
    points,
    warnings,
    sourceMetadata: { delimiter: delimiter.candidate === "\t" ? "tab" : delimiter.candidate },
  });
}

function parseJcamp(text: string, fileName: string): NormalizedSpectrum {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata: Record<string, string> = {};
  const dataLines: string[] = [];
  let inData = false;
  let dataMode = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const metadataMatch = line.match(/^##([^=]+)=(.*)$/);
    if (metadataMatch) {
      const key = metadataMatch[1].trim().toUpperCase();
      const value = metadataMatch[2].trim();
      metadata[key] = value;
      if (key === "XYDATA" || key === "PEAK TABLE" || key === "XYPOINTS") {
        inData = true;
        dataMode = value.toUpperCase();
      } else if (key === "END") {
        inData = false;
      }
      continue;
    }
    if (inData && line && !line.startsWith("$$")) dataLines.push(line);
  }

  if (!metadata["JCAMP-DX"] && !metadata.XYDATA && !metadata["PEAK TABLE"]) {
    throw new SpectrumParseError("JCAMP_HEADER_MISSING", "The file does not contain a valid JCAMP-DX header.");
  }
  if (!dataLines.length) {
    throw new SpectrumParseError("JCAMP_DATA_MISSING", "The JCAMP-DX file does not contain an XY data block.");
  }

  const xFactor = numericValue(metadata.XFACTOR ?? "1") ?? 1;
  const yFactor = numericValue(metadata.YFACTOR ?? "1") ?? 1;
  const expectedPoints = numericValue(metadata.NPOINTS ?? "");
  const firstX = numericValue(metadata.FIRSTX ?? "");
  const lastX = numericValue(metadata.LASTX ?? "");
  const declaredDelta = numericValue(metadata.DELTAX ?? "");
  const inferredDelta = expectedPoints && expectedPoints > 1 && firstX !== null && lastX !== null
    ? (lastX - firstX) / (expectedPoints - 1)
    : null;
  const deltaX = declaredDelta ?? inferredDelta;
  const packedMode = dataMode.includes("X++") && dataMode.includes("Y..Y");
  const points: SpectrumPoint[] = [];
  const warnings: string[] = [];

  for (const rawLine of dataLines) {
    const withoutComment = rawLine.split("$$")[0];
    const tokens = withoutComment.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][-+]?\d+)?/g) ?? [];
    const numbers = tokens.map(numericValue).filter((value): value is number => value !== null);
    if (numbers.length < 2) continue;

    if (packedMode && numbers.length > 2) {
      if (deltaX === null) {
        throw new SpectrumParseError(
          "JCAMP_DELTAX_MISSING",
          "Packed JCAMP-DX data requires DELTAX or FIRSTX/LASTX/NPOINTS metadata.",
        );
      }
      const xStart = numbers[0] * xFactor;
      numbers.slice(1).forEach((y, index) => {
        points.push({ x: xStart + index * deltaX * xFactor, y: y * yFactor });
      });
    } else {
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({ x: numbers[index] * xFactor, y: numbers[index + 1] * yFactor });
      }
      if (numbers.length % 2 !== 0) warnings.push("An unmatched value in the JCAMP-DX data block was ignored.");
    }
  }

  const xUnit = metadata.XUNITS || "unknown";
  const yUnit = metadata.YUNITS || "unknown";
  if (xUnit === "unknown" || yUnit === "unknown") warnings.push("One or more axis units are missing and require confirmation.");

  return summarize(
    {
      format: "JCAMP-DX",
      technique: determineTechnique(xUnit, yUnit, metadata.TITLE ?? fileName),
      title: metadata.TITLE || fileName.replace(/\.[^.]+$/, ""),
      xUnit,
      yUnit,
      points,
      warnings,
      sourceMetadata: metadata,
    },
    expectedPoints,
  );
}

export function parseSpectrumFile(
  bytes: Uint8Array,
  fileName: string,
): NormalizedSpectrum {
  const text = decodeText(bytes);
  const lowerName = fileName.toLowerCase();
  const looksLikeJcamp = /(^|\n)##(?:TITLE|JCAMP-DX|XYDATA)=/i.test(text);
  if (looksLikeJcamp || /\.(jdx|dx|jcamp)$/.test(lowerName)) {
    return parseJcamp(text, fileName);
  }
  if (/\.(csv|tsv|txt)$/.test(lowerName) || /[,;\t]/.test(text.slice(0, 300))) {
    return parseCsv(text, fileName);
  }
  throw new SpectrumParseError(
    "UNSUPPORTED_FORMAT",
    "Only text-based JCAMP-DX, CSV, and TSV spectra are supported in this pilot.",
  );
}

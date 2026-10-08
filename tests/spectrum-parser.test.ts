import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSpectrumFile,
  SpectrumParseError,
} from "../lib/science/spectrum-parser";

const encode = (value: string) => new TextEncoder().encode(value);

test("parses an explicit UV-Vis CSV spectrum", () => {
  const parsed = parseSpectrumFile(
    encode("Wavelength (nm),Absorbance (AU)\n250,0.1\n260,0.4\n270,0.9\n280,0.3"),
    "river-sample.csv",
  );

  assert.equal(parsed.format, "CSV");
  assert.equal(parsed.technique, "UV-Vis");
  assert.equal(parsed.pointCount, 4);
  assert.equal(parsed.xUnit, "nm");
  assert.equal(parsed.yMax, 0.9);
  assert.equal(parsed.axisDirection, "ascending");
});

test("recognizes machine-friendly underscore axis units", () => {
  const parsed = parseSpectrumFile(
    encode("wavelength_nm,absorbance_au\n220,0.1\n240,0.2\n260,0.5"),
    "instrument-export.csv",
  );

  assert.equal(parsed.technique, "UV-Vis");
  assert.equal(parsed.xUnit, "nm");
  assert.equal(parsed.yUnit, "AU");
  assert.deepEqual(parsed.warnings, []);
});

test("parses packed JCAMP-DX XYDATA using DELTAX", () => {
  const parsed = parseSpectrumFile(
    encode(`##TITLE=Reference spectrum
##JCAMP-DX=5.01
##XUNITS=NM
##YUNITS=ABSORBANCE
##NPOINTS=4
##FIRSTX=250
##LASTX=280
##DELTAX=10
##XYDATA=(X++(Y..Y))
250 0.1 0.4 0.9 0.3
##END=`),
    "reference.jdx",
  );

  assert.equal(parsed.format, "JCAMP-DX");
  assert.equal(parsed.pointCount, 4);
  assert.deepEqual(parsed.points.at(-1), { x: 280, y: 0.3 });
  assert.equal(parsed.warnings.length, 0);
});

test("rejects files without a supported spectral data structure", () => {
  assert.throws(
    () => parseSpectrumFile(encode("not a spectrum"), "notes.pdf"),
    (error: unknown) => error instanceof SpectrumParseError && error.code === "UNSUPPORTED_FORMAT",
  );
});

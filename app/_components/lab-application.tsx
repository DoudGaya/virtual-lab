"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Theme = "light" | "dark";
type View =
  | "Overview"
  | "Projects"
  | "Compounds"
  | "Samples"
  | "Experiments"
  | "Spectra"
  | "Laboratory notebook"
  | "Virtual lab"
  | "Instruments"
  | "Reviews";

type NavItem = { label: View; code: string; count?: number };

type ProjectRecord = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  domain: string;
  purpose: string;
  status: "Draft" | "Active" | "Under review" | "Archived";
  memberCount: number;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};

type SessionSummary = {
  name: string;
  email: string;
  role: string;
  tenantName: string;
};

type ProjectInput = {
  name: string;
  domain: string;
  purpose: string;
};

type SpectrumRecord = {
  id: string;
  publicId: string;
  projectId: string;
  projectName: string;
  sampleId: string | null;
  title: string;
  fileName: string;
  technique: string;
  format: string;
  xUnit: string;
  yUnit: string;
  pointCount: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  warnings: string[];
  sha256: string;
  status: "Draft" | "Under review" | "Accepted";
  createdAt: string;
};

const navigation: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", code: "OV" },
      { label: "Projects", code: "PR", count: 4 },
      { label: "Compounds", code: "CM" },
      { label: "Samples", code: "SA", count: 12 },
    ],
  },
  {
    label: "Laboratory",
    items: [
      { label: "Experiments", code: "EX" },
      { label: "Spectra", code: "SP", count: 3 },
      { label: "Laboratory notebook", code: "LN" },
      { label: "Virtual lab", code: "VL" },
    ],
  },
  {
    label: "Assurance",
    items: [
      { label: "Instruments", code: "IN" },
      { label: "Reviews", code: "RV", count: 5 },
    ],
  },
];

const searchRecords = [
  { type: "Project", title: "Water quality screening", meta: "ENV-024" },
  { type: "Compound", title: "Caffeine reference standard", meta: "CMP-1048" },
  { type: "Sample", title: "River sample R-14", meta: "SAM-2411" },
  { type: "Spectrum", title: "UV-Vis replicate 03", meta: "DAT-8872" },
  { type: "Notebook", title: "Calibration curve and dilution notes", meta: "ELN-219" },
];

const moduleCopy: Record<Exclude<View, "Overview" | "Spectra" | "Virtual lab">, {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  columns: string[];
  rows: string[][];
}> = {
  Projects: {
    eyebrow: "Research portfolio",
    title: "Projects",
    description: "Private, permissioned workspaces that connect samples, methods, data, interpretation, and review.",
    action: "New project",
    columns: ["Project", "Domain", "Members", "Last activity", "Status"],
    rows: [
      ["Water quality screening", "Environmental", "6", "12 min ago", "Active"],
      ["Natural products library", "Organic chemistry", "4", "Yesterday", "Review"],
      ["UV-Vis teaching pilot", "Education", "28", "2 days ago", "Active"],
      ["Corrosion inhibitor study", "Materials", "5", "6 days ago", "Draft"],
    ],
  },
  Compounds: {
    eyebrow: "Chemistry registry",
    title: "Compounds",
    description: "Versioned structures and identifiers with their submitted form, validation status, and scientific provenance.",
    action: "Register compound",
    columns: ["Compound", "Formula", "Registry ID", "Structure", "Status"],
    rows: [
      ["Caffeine reference standard", "C8H10N4O2", "CMP-1048", "Verified", "Approved"],
      ["Benzoic acid", "C7H6O2", "CMP-1017", "Verified", "Approved"],
      ["Unknown fraction A3", "Pending", "CMP-1061", "Unresolved", "Review"],
      ["Potassium permanganate", "KMnO4", "CMP-992", "Verified", "Approved"],
    ],
  },
  Samples: {
    eyebrow: "Traceable materials",
    title: "Samples",
    description: "Track source, preparation, storage, custody, and every analytical result without breaking lineage.",
    action: "Register sample",
    columns: ["Sample", "Source", "Parent", "Storage", "State"],
    rows: [
      ["River sample R-14", "Field collection", "-", "Cold room B2", "Available"],
      ["R-14 filtered aliquot", "Prepared", "SAM-2411", "Rack 07", "In analysis"],
      ["Caffeine standard 20 ppm", "Prepared", "LOT-443", "Amber tray", "Available"],
      ["Unknown fraction A3", "Column fraction", "SAM-2388", "Freezer F1", "Restricted"],
    ],
  },
  Experiments: {
    eyebrow: "Methods and runs",
    title: "Experiments",
    description: "Plan controlled work with explicit variables, calculations, hazards, acceptance criteria, and stopping conditions.",
    action: "Plan experiment",
    columns: ["Experiment", "Method", "Owner", "Next step", "Status"],
    rows: [
      ["UV-Vis nitrate screening", "UVV-004 v2.1", "A. Bello", "Review calibration", "Running"],
      ["Acid-base standardisation", "TIT-012 v1.4", "D. Musa", "Submit results", "Review"],
      ["Corrosion coupon set B", "MAT-008 v0.8", "K. Okafor", "Safety approval", "Draft"],
      ["Fraction A3 characterisation", "NAT-019 v1.0", "T. Adeyemi", "Upload IR", "Blocked"],
    ],
  },
  "Laboratory notebook": {
    eyebrow: "Electronic laboratory notebook",
    title: "Laboratory notebook",
    description: "A reviewable scientific record linking objectives, methods, raw observations, calculations, data, and conclusions.",
    action: "New entry",
    columns: ["Entry", "Project", "Author", "Modified", "Review state"],
    rows: [
      ["Calibration curve and dilution notes", "Water quality", "A. Bello", "18 min ago", "Draft"],
      ["Sample preparation R-14", "Water quality", "D. Musa", "Today", "Submitted"],
      ["Fraction A3 isolation", "Natural products", "T. Adeyemi", "Yesterday", "Revision"],
      ["Instrument suitability check", "Teaching pilot", "K. Okafor", "2 days ago", "Approved"],
    ],
  },
  Instruments: {
    eyebrow: "Laboratory operations",
    title: "Instruments",
    description: "Maintain instrument context, qualification, calibration, availability, and supported data formats.",
    action: "Add instrument",
    columns: ["Instrument", "Location", "Calibration", "Availability", "State"],
    rows: [
      ["Shimadzu UV-1900i", "Analytical lab", "Valid to 14 Nov", "Available", "Ready"],
      ["FTIR-8400S", "Research lab 2", "Due in 11 days", "Booked", "Attention"],
      ["HPLC 1260 Infinity", "Central lab", "Valid to 03 Dec", "Maintenance", "Offline"],
      ["pH meter PH-07", "Teaching lab", "Valid to 26 Oct", "Available", "Ready"],
    ],
  },
  Reviews: {
    eyebrow: "Scientific assurance",
    title: "Review queue",
    description: "Keep AI suggestions, analyst interpretation, supporting evidence, and the approved conclusion clearly separated.",
    action: "Review settings",
    columns: ["Review item", "Submitted by", "Evidence", "Due", "Priority"],
    rows: [
      ["UV-Vis replicate 03", "A. Bello", "8 records", "Today", "High"],
      ["Fraction A3 assignments", "T. Adeyemi", "14 records", "Tomorrow", "High"],
      ["Titration practical 4B", "D. Musa", "22 attempts", "26 Oct", "Normal"],
      ["Instrument suitability check", "K. Okafor", "5 records", "28 Oct", "Normal"],
    ],
  },
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-mark-ring" />
      <span className="brand-mark-core">C</span>
      <span className="brand-mark-dot brand-mark-dot-one" />
      <span className="brand-mark-dot brand-mark-dot-two" />
    </span>
  );
}

function StatusBadge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" | "amber" | "violet" | "slate" }) {
  return <span className={`status-badge status-${tone}`}><span aria-hidden="true" />{children}</span>;
}

function SpectrumChart({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className={`spectrum-chart${expanded ? " spectrum-expanded" : ""}`}>
      <div className="chart-y-label">Absorbance (AU)</div>
      <svg viewBox="0 0 760 260" role="img" aria-labelledby={expanded ? "spectra-chart-title-expanded" : "spectra-chart-title"} preserveAspectRatio="none">
        <title id={expanded ? "spectra-chart-title-expanded" : "spectra-chart-title"}>UV-Vis spectrum with a primary peak at 273 nanometres</title>
        <defs>
          <linearGradient id={expanded ? "spectrum-fill-expanded" : "spectrum-fill"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid">
          {[30, 80, 130, 180, 230].map((y) => <line key={`y-${y}`} x1="44" y1={y} x2="744" y2={y} />)}
          {[44, 144, 244, 344, 444, 544, 644, 744].map((x) => <line key={`x-${x}`} x1={x} y1="18" x2={x} y2="230" />)}
        </g>
        <path className="chart-area" d="M44 221 C86 220 112 216 144 211 C176 206 195 201 220 197 C242 193 257 189 270 176 C286 158 292 101 307 50 C315 23 324 21 334 58 C347 109 352 165 371 188 C395 214 424 210 452 207 C484 205 500 194 523 184 C545 175 560 182 577 193 C600 208 625 213 650 211 C681 209 702 202 744 199 L744 230 L44 230 Z" fill={`url(#${expanded ? "spectrum-fill-expanded" : "spectrum-fill"})`} />
        <path className="chart-line" d="M44 221 C86 220 112 216 144 211 C176 206 195 201 220 197 C242 193 257 189 270 176 C286 158 292 101 307 50 C315 23 324 21 334 58 C347 109 352 165 371 188 C395 214 424 210 452 207 C484 205 500 194 523 184 C545 175 560 182 577 193 C600 208 625 213 650 211 C681 209 702 202 744 199" />
        <line className="peak-guide" x1="320" y1="23" x2="320" y2="230" />
        <circle className="peak-point" cx="320" cy="29" r="5" />
        <g className="chart-labels"><text x="46" y="251">200</text><text x="240" y="251">250</text><text x="438" y="251">300</text><text x="634" y="251">350</text></g>
      </svg>
      <span className="peak-label"><b>273 nm</b><small>0.842 AU</small></span>
      <div className="chart-x-label">Wavelength (nm)</div>
    </div>
  );
}

function OverviewDashboard({ onNavigate, projectCount }: { onNavigate: (view: View) => void; projectCount: number }) {
  return (
    <>
      <section className="metric-grid" aria-label="Workspace summary">
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-blue">PR</span><StatusBadge tone="green">Live portfolio</StatusBadge></div><strong>{projectCount}</strong><p>Research projects</p><small>Tenant-scoped and permissioned</small></article>
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-cyan">SA</span><StatusBadge tone="blue">12 tracked</StatusBadge></div><strong>28</strong><p>Samples registered</p><small>100% with recorded lineage</small></article>
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-violet">AN</span><StatusBadge tone="violet">3 processing</StatusBadge></div><strong>16</strong><p>Analyses this month</p><small>8 fully reviewed</small></article>
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-amber">RV</span><StatusBadge tone="amber">Action needed</StatusBadge></div><strong>5</strong><p>Awaiting review</p><small>2 high-priority records</small></article>
      </section>

      <section className="workspace-grid">
        <article className="panel spectrum-panel">
          <header className="panel-header"><div><span className="section-kicker">Active analysis</span><h2>UV-Vis nitrate screening</h2><p>River sample R-14 · Shimadzu UV-1900i</p></div><button className="button button-quiet" type="button" onClick={() => onNavigate("Spectra")}>Open workbench <span aria-hidden="true">↗</span></button></header>
          <div className="chart-meta"><div><span>Dataset</span><b>DAT-8872</b></div><div><span>Technique</span><b>UV-Vis</b></div><div><span>Range</span><b>200-380 nm</b></div><div><span>Source</span><b>Experimental</b></div></div>
          <SpectrumChart />
          <footer className="spectrum-footer"><div className="legend-row"><span><i className="legend-line" /> Sample R-14</span><span><i className="legend-dot" /> Selected peak</span><span><i className="legend-dash" /> Reference</span></div><StatusBadge tone="green">Raw file preserved</StatusBadge></footer>
        </article>

        <aside className="panel assurance-panel">
          <header className="panel-header compact"><div><span className="section-kicker">Scientific record</span><h2>Evidence trail</h2></div><button className="icon-button subtle" type="button" aria-label="More evidence options">•••</button></header>
          <div className="record-state"><div className="record-state-head"><StatusBadge tone="amber">Awaiting review</StatusBadge><span>7 of 8 complete</span></div><div className="progress-track"><span style={{ width: "87%" }} /></div></div>
          <ol className="provenance-list">
            <li className="complete"><span className="step-marker">1</span><div><b>Original file received</b><small>SHA-256 verified · 09:42</small></div></li>
            <li className="complete"><span className="step-marker">2</span><div><b>Metadata confirmed</b><small>Instrument, method, operator</small></div></li>
            <li className="complete"><span className="step-marker">3</span><div><b>Processing completed</b><small>Baseline correction v1.3</small></div></li>
            <li className="complete"><span className="step-marker">4</span><div><b>Analyst interpretation</b><small>A. Bello · 10:18</small></div></li>
            <li className="active"><span className="step-marker">5</span><div><b>Scientific review</b><small>Assigned to Dr. I. Okeke</small></div></li>
          </ol>
          <button className="review-card" type="button" onClick={() => onNavigate("Reviews")}><span className="review-avatar">IO</span><span><small>Assigned reviewer</small><b>Dr. Ifeoma Okeke</b></span><span aria-hidden="true">→</span></button>
        </aside>
      </section>

      <section className="lower-grid">
        <article className="panel activity-panel">
          <header className="panel-header"><div><span className="section-kicker">Workspace activity</span><h2>Recent scientific records</h2></div><button className="text-button" type="button">View audit log</button></header>
          <div className="activity-list">
            <button type="button" onClick={() => onNavigate("Laboratory notebook")}><span className="activity-symbol symbol-blue">LN</span><span><b>Calibration curve added to notebook</b><small>Water quality screening · A. Bello · 18 min ago</small></span><StatusBadge tone="blue">Draft</StatusBadge></button>
            <button type="button" onClick={() => onNavigate("Samples")}><span className="activity-symbol symbol-cyan">SA</span><span><b>R-14 filtered aliquot registered</b><small>Lineage recorded from SAM-2411 · 42 min ago</small></span><StatusBadge tone="green">Traceable</StatusBadge></button>
            <button type="button" onClick={() => onNavigate("Reviews")}><span className="activity-symbol symbol-violet">AI</span><span><b>AI summary submitted for review</b><small>8 evidence links · 2 caveats · 1 hr ago</small></span><StatusBadge tone="violet">AI draft</StatusBadge></button>
          </div>
        </article>

        <article className="panel readiness-panel">
          <header className="panel-header compact"><div><span className="section-kicker">Laboratory readiness</span><h2>Today</h2></div><button className="text-button" type="button" onClick={() => onNavigate("Instruments")}>All instruments</button></header>
          <div className="readiness-score"><div className="score-ring"><span>86</span><small>%</small></div><div><b>Ready for scheduled work</b><p>Two items need attention before tomorrow.</p></div></div>
          <ul className="readiness-list"><li><span className="ready-dot ready" /><span><b>UV-1900i</b><small>Calibrated · Available</small></span><em>Ready</em></li><li><span className="ready-dot attention" /><span><b>FTIR-8400S</b><small>Calibration due in 11 days</small></span><em>Review</em></li><li><span className="ready-dot offline" /><span><b>HPLC 1260</b><small>Planned maintenance</small></span><em>Offline</em></li></ul>
        </article>
      </section>
    </>
  );
}

function SpectraWorkbench({ spectra, loading, onImport }: { spectra: SpectrumRecord[]; loading: boolean; onImport: () => void }) {
  const [tab, setTab] = useState<"Peaks" | "Processing" | "Evidence">("Peaks");
  return (
    <>
      <section className="workbench-layout">
        <article className="panel workbench-canvas">
          <header className="workbench-toolbar"><div><StatusBadge tone="blue">Experimental</StatusBadge><span>DAT-8872</span><span>UV-Vis</span></div><div><button type="button">Undo</button><button type="button">Baseline</button><button type="button">Smooth</button><button type="button">Annotate</button></div></header>
          <div className="workbench-title"><div><h2>River sample R-14 · replicate 03</h2><p>Original upload preserved · processing pipeline UVV-PROC-1.3</p></div><StatusBadge tone="green">Quality checks passed</StatusBadge></div>
          <SpectrumChart expanded />
          <div className="workbench-foot"><span>Cursor: <b>273.2 nm</b></span><span>Absorbance: <b>0.842 AU</b></span><span>Points: <b>1,801</b></span><span>Last saved: <b>10:18</b></span></div>
        </article>
        <aside className="panel inspector-panel">
          <div className="inspector-tabs" role="tablist" aria-label="Spectrum details">{(["Peaks", "Processing", "Evidence"] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
          {tab === "Peaks" && <div className="inspector-body"><span className="section-kicker">Selected feature</span><h3>Primary absorption maximum</h3><dl className="data-list"><div><dt>Wavelength</dt><dd>273.2 nm</dd></div><div><dt>Absorbance</dt><dd>0.842 AU</dd></div><div><dt>Width</dt><dd>18.6 nm</dd></div><div><dt>Signal quality</dt><dd>Good</dd></div></dl><label className="field-label">Analyst note<textarea defaultValue="Primary band is consistent across all three replicates. Review dilution correction before finalising." /></label><button className="button button-primary full" type="button">Save annotation</button></div>}
          {tab === "Processing" && <div className="inspector-body"><span className="section-kicker">Reproducible pipeline</span><h3>Three recorded steps</h3><ol className="process-list"><li><span>01</span><div><b>Import and validation</b><small>JCAMP-DX parser v1.2</small></div></li><li><span>02</span><div><b>Blank subtraction</b><small>BLK-UV-2026-44</small></div></li><li><span>03</span><div><b>Baseline correction</b><small>AsLS · lambda 1e5 · p 0.01</small></div></li></ol><button className="button button-secondary full" type="button">View parameters</button></div>}
          {tab === "Evidence" && <div className="inspector-body"><span className="section-kicker">Interpretation boundary</span><h3>Evidence summary</h3><div className="evidence-item"><StatusBadge tone="green">Observed</StatusBadge><p>Single dominant absorption at 273.2 nm across three replicates.</p></div><div className="evidence-item"><StatusBadge tone="violet">AI draft</StatusBadge><p>Feature may be consistent with an aromatic chromophore. This is not an identity claim.</p></div><div className="evidence-item"><StatusBadge tone="amber">Missing</StatusBadge><p>Dilution correction and reference comparison require reviewer confirmation.</p></div><button className="button button-secondary full" type="button">Open review record</button></div>}
        </aside>
      </section>
      <section className="panel spectrum-library">
        <header className="module-header"><div><span className="section-kicker">Traceable data registry</span><h2>Imported spectra</h2><p>Every dataset retains its original file, checksum, parser provenance, and quality observations.</p></div><button className="button button-primary" type="button" onClick={onImport}>↑ Import spectrum</button></header>
        {loading ? <div className="table-loading" role="status"><span /> Loading spectrum records…</div> : spectra.length ? <div className="spectrum-records">{spectra.map((spectrum) => <article key={spectrum.id} className="spectrum-record"><span className="spectrum-record-icon">{spectrum.technique.slice(0, 2).toUpperCase()}</span><div className="spectrum-record-main"><div><b>{spectrum.title}</b><small>{spectrum.publicId} · {spectrum.projectName}</small></div><p>{spectrum.format} · {spectrum.pointCount.toLocaleString()} points · {spectrum.xMin}–{spectrum.xMax} {spectrum.xUnit}</p></div><div className="spectrum-record-quality"><StatusBadge tone={spectrum.warnings.length ? "amber" : "green"}>{spectrum.warnings.length ? `${spectrum.warnings.length} warning${spectrum.warnings.length === 1 ? "" : "s"}` : "Checks passed"}</StatusBadge><small title={spectrum.sha256}>SHA-256 · {spectrum.sha256.slice(0, 12)}…</small></div></article>)}</div> : <div className="spectrum-empty"><span>SP</span><div><b>No spectra imported yet</b><p>Add a CSV or JCAMP-DX file to create the first traceable data record.</p></div><button className="button button-secondary" type="button" onClick={onImport}>Choose a file</button></div>}
      </section>
    </>
  );
}

function VirtualLabView() {
  const experiments = [
    { code: "TIT", title: "Acid-base titration", level: "Foundation", duration: "35 min", progress: 72, color: "blue" },
    { code: "DIL", title: "Solution preparation", level: "Foundation", duration: "25 min", progress: 100, color: "cyan" },
    { code: "UVV", title: "UV-Vis calibration curve", level: "Intermediate", duration: "50 min", progress: 38, color: "violet" },
  ];
  return (
    <>
      <section className="virtual-hero panel"><div className="virtual-copy"><StatusBadge tone="blue">Scientist-validated simulations</StatusBadge><h2>Prepare for the physical laboratory with evidence, not guesswork.</h2><p>Practise technique, calculations, safety decisions, and data interpretation in deterministic experiment models. Simulated results always remain visibly separate from physical observations.</p><div className="hero-actions"><button className="button button-primary" type="button">Continue current session</button><button className="button button-secondary" type="button">Browse experiments</button></div></div><div className="lab-visual" aria-label="Stylised virtual laboratory apparatus"><div className="lab-grid-lines" /><div className="burette"><span /></div><div className="flask"><span className="flask-liquid" /></div><div className="lab-reading"><small>VOLUME</small><b>18.40</b><span>mL</span></div><div className="lab-state"><span /> Simulation state recorded</div></div></section>
      <section className="experiment-grid">{experiments.map((experiment, index) => <article className="panel experiment-card" key={experiment.code}><div className={`experiment-art experiment-${experiment.color}`}><span>{experiment.code}</span><i /><b>0{index + 1}</b></div><div className="experiment-body"><div className="experiment-meta"><span>{experiment.level}</span><span>{experiment.duration}</span></div><h3>{experiment.title}</h3><p>{experiment.code === "UVV" ? "Build a calibration curve, assess linearity, and report an unknown with assumptions." : experiment.code === "TIT" ? "Practise apparatus preparation, endpoint control, replicate agreement, and calculations." : "Prepare a standard solution with unit-aware calculations and uncertainty checks."}</p><div className="progress-row"><div className="progress-track"><span style={{ width: `${experiment.progress}%` }} /></div><b>{experiment.progress}%</b></div><button className="text-button" type="button">{experiment.progress === 100 ? "Review competency" : "Open experiment"} <span aria-hidden="true">→</span></button></div></article>)}</section>
    </>
  );
}

function ModuleTable({ view, onAction, rows, loading = false }: { view: Exclude<View, "Overview" | "Spectra" | "Virtual lab">; onAction: () => void; rows?: string[][]; loading?: boolean }) {
  const moduleDetails = moduleCopy[view];
  const displayedRows = rows ?? moduleDetails.rows;
  return (
    <section className="panel module-panel">
      <header className="module-header"><div><span className="section-kicker">{moduleDetails.eyebrow}</span><h2>{moduleDetails.title}</h2><p>{moduleDetails.description}</p></div><button className="button button-primary" type="button" onClick={onAction}>+ {moduleDetails.action}</button></header>
      <div className="module-filters"><div className="filter-search"><span className="search-symbol" aria-hidden="true" /><input aria-label={`Search ${moduleDetails.title.toLowerCase()}`} placeholder={`Search ${moduleDetails.title.toLowerCase()}...`} /></div><button type="button">All states</button><button type="button">Recently updated</button></div>
      {loading ? <div className="table-loading" role="status"><span /> Loading secure workspace records…</div> : <div className="data-table-wrap"><table className="data-table"><thead><tr>{moduleDetails.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{displayedRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${moduleDetails.columns[index]}`}>{index === 0 ? <span className="table-primary"><i>{row[0].slice(0, 2).toUpperCase()}</i><b>{cell}</b></span> : index === row.length - 1 ? <StatusBadge tone={cell === "Approved" || cell === "Ready" || cell === "Active" || cell === "Available" ? "green" : cell === "Review" || cell === "Under review" || cell === "Attention" || cell === "High" || cell === "Blocked" ? "amber" : "slate"}>{cell}</StatusBadge> : cell}</td>)}</tr>)}</tbody></table></div>}
    </section>
  );
}

function CreateProjectModal({ onClose, onCreate, submitting, error, persistent }: { onClose: () => void; onCreate: (input: ProjectInput) => Promise<void>; submitting: boolean; error: string; persistent: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onCreate({
      name: String(form.get("name") ?? ""),
      domain: String(form.get("domain") ?? ""),
      purpose: String(form.get("purpose") ?? ""),
    });
  };
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" ref={dialogRef}><header><div><span className="section-kicker">Create research workspace</span><h2 id="project-dialog-title">New project</h2></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={submitting}>×</button></header><form onSubmit={submit}><label className="field-label">Project name<input name="name" required minLength={3} maxLength={180} placeholder="e.g. Coastal water quality study" /></label><label className="field-label">Research domain<select name="domain" defaultValue="Environmental chemistry"><option>Environmental chemistry</option><option>Analytical chemistry</option><option>Organic chemistry</option><option>Materials chemistry</option><option>Chemistry education</option></select></label><label className="field-label">Purpose<textarea name="purpose" required minLength={20} maxLength={2000} placeholder="Describe the research question and intended outcome." /></label>{error && <div className="form-error" role="alert"><span>!</span><p>{error}</p></div>}<div className="form-note"><span>i</span><p>{persistent ? "This record will be written to PostgreSQL with an audit event and transactional outbox event." : "Local demo mode stores the record in server memory and still exercises validation, authorization, audit, and event boundaries."}</p></div><footer><button className="button button-secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create project"}</button></footer></form></div></div>;
}

function ImportSpectrumModal({ projects, onClose, onImport, submitting, error, persistent }: { projects: ProjectRecord[]; onClose: () => void; onImport: (projectId: string, file: File) => Promise<void>; submitting: boolean; error: string; persistent: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", handleKey);
    dialogRef.current?.querySelector<HTMLElement>("select")?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, submitting]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("spectrumFile");
    if (!(file instanceof File) || file.size === 0) return;
    await onImport(String(form.get("projectId") ?? ""), file);
  };

  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <div className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" ref={dialogRef}>
        <header><div><span className="section-kicker">Scientific data intake</span><h2 id="import-dialog-title">Import a spectrum</h2></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={submitting}>×</button></header>
        <form onSubmit={submit}>
          <label className="field-label">Research project<select name="projectId" defaultValue={projects[0]?.id} required disabled={submitting || !projects.length}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name} · {project.publicId}</option>)}</select></label>
          <label className={`spectrum-file-drop${selectedFile ? " selected" : ""}`}>
            <input name="spectrumFile" type="file" accept=".csv,.tsv,.txt,.jdx,.dx,.jcamp,text/csv,text/plain,chemical/x-jcamp-dx" required disabled={submitting} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <span className="upload-symbol">↑</span>
            <b>{selectedFile ? selectedFile.name : "Choose a spectrum file"}</b>
            <small>{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB · ready for validation` : "CSV, TSV or JCAMP-DX · maximum 5 MB"}</small>
          </label>
          <ol className="import-assurance"><li><span>01</span><div><b>Preserve</b><small>Store the submitted bytes immutably with a SHA-256 checksum.</small></div></li><li><span>02</span><div><b>Validate</b><small>Parse axes, units, ranges, point count, and quality warnings deterministically.</small></div></li><li><span>03</span><div><b>Register</b><small>Create a traceable spectrum, audit event, and processing record.</small></div></li></ol>
          {error && <div className="form-error" role="alert"><span>!</span><p>{error}</p></div>}
          <div className="form-note"><span>i</span><p>{persistent ? "The source and normalized artifact will use the configured private object store and PostgreSQL lineage records." : "Development mode uses private local quarantine storage. Configure private S3-compatible storage before production deployment."}</p></div>
          <footer><button className="button button-secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button><button className="button button-primary" type="submit" disabled={submitting || !projects.length || !selectedFile}>{submitting ? "Validating and importing…" : "Import spectrum"}</button></footer>
        </form>
      </div>
    </div>
  );
}

export function LabApplication() {
  const [theme, setTheme] = useState<Theme>("light");
  const [view, setView] = useState<View>("Overview");
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [spectra, setSpectra] = useState<SpectrumRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [spectraLoading, setSpectraLoading] = useState(true);
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [importError, setImportError] = useState("");
  const [dataMode, setDataMode] = useState<"postgresql" | "demo-memory" | "connecting">("connecting");
  const [session, setSession] = useState<SessionSummary>({
    name: "Amara Bello",
    email: "amara.bello@demo.chemcider.com",
    role: "RESEARCHER",
    tenantName: "Chemcider University Lab",
  });
  const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const bootstrapWorkspace = async () => {
      try {
        let sessionResponse = await fetch("/api/v1/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (sessionResponse.status === 401) {
          sessionResponse = await fetch("/api/v1/session/demo", {
            method: "POST",
            signal: controller.signal,
          });
        }
        if (!sessionResponse.ok) throw new Error("A secure workspace session could not be established.");
        const sessionPayload = await sessionResponse.json() as { data: SessionSummary };
        setSession(sessionPayload.data);

        const [projectsResponse, spectraResponse] = await Promise.all([
          fetch("/api/v1/projects", { cache: "no-store", signal: controller.signal }),
          fetch("/api/v1/spectra", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!projectsResponse.ok || !spectraResponse.ok) throw new Error("Workspace scientific records could not be loaded.");
        const projectsPayload = await projectsResponse.json() as {
          data: ProjectRecord[];
          meta: { adapter: "postgresql" | "demo-memory" };
        };
        const spectraPayload = await spectraResponse.json() as { data: SpectrumRecord[] };
        setProjects(projectsPayload.data);
        setSpectra(spectraPayload.data);
        setDataMode(projectsPayload.meta.adapter);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setNotice(error instanceof Error ? error.message : "Workspace data is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setProjectsLoading(false);
          setSpectraLoading(false);
        }
      }
    };

    void bootstrapWorkspace();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const closePanels = (event: PointerEvent) => {
      if (searchRef.current?.contains(event.target as Node)) return;
      setSearchOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", closePanels);
    return () => document.removeEventListener("pointerdown", closePanels);
  }, []);

  const filteredSearch = useMemo(() => {
    if (!query.trim()) return searchRecords.slice(0, 3);
    return searchRecords.filter((record) => `${record.type} ${record.title} ${record.meta}`.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("chemcider-theme", next);
  };

  const navigate = (next: View) => {
    setView(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openProjectModal = () => {
    setProjectError("");
    setProjectModalOpen(true);
  };

  const openImportModal = () => {
    setImportError("");
    setImportModalOpen(true);
  };

  const createProjectRecord = async (input: ProjectInput) => {
    setProjectError("");
    setProjectSubmitting(true);
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json() as {
        data?: ProjectRecord;
        title?: string;
        detail?: string;
        errors?: Array<{ message: string }>;
      };
      if (!response.ok || !payload.data) {
        throw new Error(
          payload.errors?.[0]?.message ??
            payload.detail ??
            payload.title ??
            "The project could not be created.",
        );
      }
      setProjects((current) => [payload.data as ProjectRecord, ...current]);
      setProjectModalOpen(false);
      setView("Projects");
      setNotice(`${payload.data.name} was created with an auditable project record.`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "The project could not be created.");
    } finally {
      setProjectSubmitting(false);
    }
  };

  const importSpectrum = async (projectId: string, file: File) => {
    setImportError("");
    if (file.size > 5 * 1024 * 1024) {
      setImportError("The selected file exceeds the 5 MB scientific-ingestion limit.");
      return;
    }
    setImportSubmitting(true);
    try {
      const intentResponse = await fetch("/api/v1/uploads/intents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          contentType: file.type || "text/plain",
          expectedBytes: file.size,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const intentPayload = await intentResponse.json() as {
        data?: { uploadUrl: string };
        title?: string;
        detail?: string;
        errors?: Array<{ message: string }>;
      };
      if (!intentResponse.ok || !intentPayload.data) {
        throw new Error(intentPayload.errors?.[0]?.message ?? intentPayload.detail ?? intentPayload.title ?? "The upload could not be prepared.");
      }

      const uploadBody = new FormData();
      uploadBody.set("file", file);
      const uploadResponse = await fetch(intentPayload.data.uploadUrl, { method: "POST", body: uploadBody });
      const uploadPayload = await uploadResponse.json() as {
        data?: SpectrumRecord;
        title?: string;
        detail?: string;
        errors?: Array<{ message: string }>;
      };
      if (!uploadResponse.ok || !uploadPayload.data) {
        throw new Error(uploadPayload.errors?.[0]?.message ?? uploadPayload.detail ?? uploadPayload.title ?? "The spectrum could not be imported.");
      }

      const imported = uploadPayload.data;
      setSpectra((current) => [imported, ...current]);
      setImportModalOpen(false);
      setView("Spectra");
      setNotice(`${imported.publicId} imported · ${imported.pointCount.toLocaleString()} points · ${imported.warnings.length ? `${imported.warnings.length} quality warning${imported.warnings.length === 1 ? "" : "s"}` : "quality checks passed"}.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The spectrum could not be imported.");
    } finally {
      setImportSubmitting(false);
    }
  };

  const projectRows = useMemo(
    () => projects.map((project) => [
      project.name,
      project.domain,
      String(project.memberCount),
      new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(project.updatedAt)),
      project.status,
    ]),
    [projects],
  );

  const initials = session.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const firstName = session.name.split(/\s+/)[0];
  const roleLabel = session.role.toLowerCase().replaceAll("_", " ");

  const viewDescription = view === "Overview"
    ? "A traceable view of your current research, data, laboratory readiness, and scientific review."
    : view === "Spectra"
      ? "Process, annotate, compare, and review instrument data without losing the original scientific record."
      : view === "Virtual lab"
        ? "Validated practical simulations connected to calculations, safety decisions, and laboratory competency."
        : moduleCopy[view].description;

  return (
    <div className={`app-shell${compact ? " sidebar-compact" : ""}`}>
      <button className={`mobile-scrim${mobileOpen ? " open" : ""}`} aria-label="Close navigation" type="button" onClick={() => setMobileOpen(false)} />
      <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-brand"><BrandMark /><span className="brand-copy"><b>Chemcider</b><small>LABS</small></span><button className="sidebar-collapse" type="button" onClick={() => setCompact((value) => !value)} aria-label={compact ? "Expand navigation" : "Collapse navigation"}>{compact ? "→" : "←"}</button></div>
        <div className="workspace-switch"><span className="workspace-logo">CU</span><span><small>Institution workspace</small><b>Chemcider University Lab</b></span><i aria-hidden="true">⌄</i></div>
        <nav className="sidebar-nav" aria-label="Product navigation">{navigation.map((section) => <div className="nav-section" key={section.label}><p>{section.label}</p>{section.items.map((item) => { const count = item.label === "Projects" ? (projects.length || item.count) : item.label === "Spectra" ? (spectra.length || item.count) : item.count; return <button key={item.label} type="button" className={view === item.label ? "active" : ""} onClick={() => navigate(item.label)} title={compact ? item.label : undefined}><span className="nav-glyph">{item.code}</span><span className="nav-label">{item.label}</span>{count ? <small>{count}</small> : null}</button>; })}</div>)}</nav>
        <div className="sidebar-foot"><div className="sync-status"><span /><div><b>Workspace synced</b><small>All records up to date</small></div></div><button className="support-button" type="button"><span>?</span><div><b>Help and support</b><small>Documentation and guides</small></div></button></div>
      </aside>

      <div className="app-stage">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><span /><span /><span /></button><div className="mobile-brand"><BrandMark /><b>Chemcider Labs</b></div></div>
          <div className="global-search" ref={searchRef}><span className="search-symbol" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(true)} placeholder="Search projects, samples, compounds, data..." aria-label="Search Chemcider Labs" /><kbd>⌘ K</kbd>{searchOpen && <div className="search-panel"><div className="search-panel-head"><span>Quick results</span><small>{filteredSearch.length} records</small></div>{filteredSearch.length ? filteredSearch.map((record) => <button type="button" key={record.meta} onClick={() => { setSearchOpen(false); setQuery(record.title); }}><span>{record.type.slice(0, 2).toUpperCase()}</span><div><b>{record.title}</b><small>{record.type} · {record.meta}</small></div><i>↗</i></button>) : <p className="no-results">No matching scientific records.</p>}<footer>Search is limited to this demonstration workspace.</footer></div>}</div>
          <div className="topbar-actions"><div className={`connection-state connection-${dataMode}`} title={dataMode === "postgresql" ? "Persistent PostgreSQL workspace" : "Local development data adapter"}><span /> {dataMode === "connecting" ? "Connecting…" : dataMode === "postgresql" ? "PostgreSQL · Synced" : "Demo data · Local"}</div><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}><span className={theme === "light" ? "active" : ""}>☼</span><span className={theme === "dark" ? "active" : ""}>☾</span></button><div className="notification-wrap"><button className="icon-button notification-button" type="button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={(event) => { event.stopPropagation(); setNotificationsOpen((value) => !value); setSearchOpen(false); }}><span className="notification-icon">!</span><i /></button>{notificationsOpen && <div className="notification-panel"><header><b>Notifications</b><span>3 new</span></header><button type="button"><i className="notice-dot amber" /><span><b>Review requested</b><small>UV-Vis replicate 03 · 12 min ago</small></span></button><button type="button"><i className="notice-dot blue" /><span><b>Instrument record updated</b><small>FTIR-8400S · 48 min ago</small></span></button><button type="button"><i className="notice-dot violet" /><span><b>AI task completed</b><small>Evidence summary · 1 hr ago</small></span></button></div>}</div><button className="profile-button" type="button"><span>{initials}</span><div><b>{session.name}</b><small>{roleLabel}</small></div><i>⌄</i></button></div>
        </header>

        <main className="main-content">
          <header className="page-heading"><div><div className="breadcrumbs"><span>{session.tenantName}</span><i>/</i><b>{view}</b></div><h1>{view === "Overview" ? `Good morning, ${firstName}` : view}</h1><p>{viewDescription}</p></div><div className="page-actions"><button className="button button-secondary" type="button" onClick={openImportModal}><span className="button-symbol">↑</span> Import data</button><button className="button button-primary" type="button" onClick={openProjectModal}><span className="button-symbol">+</span> New project</button></div></header>
          {view === "Overview" && <OverviewDashboard onNavigate={navigate} projectCount={projects.length || 4} />}
          {view === "Spectra" && <SpectraWorkbench spectra={spectra} loading={spectraLoading} onImport={openImportModal} />}
          {view === "Virtual lab" && <VirtualLabView />}
          {view !== "Overview" && view !== "Spectra" && view !== "Virtual lab" && <ModuleTable view={view} rows={view === "Projects" ? projectRows : undefined} loading={view === "Projects" && projectsLoading} onAction={() => view === "Projects" ? openProjectModal() : setNotice(`${moduleCopy[view].action} is prepared for the next domain workflow milestone.`)} />}
          <footer className="app-footer"><span>CHEMCIDER LABS · {dataMode === "postgresql" ? "PERSISTENT WORKSPACE" : "LOCAL DEMONSTRATION WORKSPACE"}</span><p>Scientific suggestions require qualified human review.</p><span>v0.2 · Lagos, Nigeria</span></footer>
        </main>
      </div>
      {notice && <div className="app-toast" role="status"><span>✓</span><p>{notice}</p><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
      {projectModalOpen && <CreateProjectModal onClose={() => setProjectModalOpen(false)} onCreate={createProjectRecord} submitting={projectSubmitting} error={projectError} persistent={dataMode === "postgresql"} />}
      {importModalOpen && <ImportSpectrumModal projects={projects} onClose={() => setImportModalOpen(false)} onImport={importSpectrum} submitting={importSubmitting} error={importError} persistent={dataMode === "postgresql"} />}
    </div>
  );
}

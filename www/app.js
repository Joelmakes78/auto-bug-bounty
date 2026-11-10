const STORAGE_KEY = "scopesafe.workspace.v1";
const emptyState = () => ({ programs: [], findings: [], projects: [] });

let state = emptyState();
let selectedReportId = null;
let toastTimer;
let installPrompt = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function showNotice(message) {
  const notice = $("#storage-notice");
  notice.textContent = message;
  notice.hidden = false;
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.programs) || !Array.isArray(parsed.findings)) {
      throw new Error("The saved workspace has an invalid format.");
    }
    state = { ...parsed, projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch (error) {
    state = emptyState();
    showNotice(`Saved workspace could not be loaded: ${error.message} Your current session is temporary.`);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("#storage-notice").hidden = true;
  } catch (error) {
    showNotice(`Changes are only in memory and may not persist: ${error.message}`);
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function safeText(value = "") {
  return escapeHTML(value);
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function shortDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function initials(value) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "P";
}

function programFor(finding) {
  return state.programs.find((program) => program.id === finding.programId);
}

function severityClass(severity) {
  return severity.toLowerCase();
}

function emptyMessage(title, description) {
  return `<div class="empty-state"><span class="empty-symbol">⌑</span><strong>${safeText(title)}</strong><p>${safeText(description)}</p></div>`;
}

function programRow(program) {
  return `<div class="program-row">
    <span class="program-icon">${safeText(initials(program.name))}</span>
    <span class="row-main"><strong>${safeText(program.name)}</strong><small>${safeText(program.platform || "Private program")} · ${program.scope.length} scoped ${program.scope.length === 1 ? "domain" : "domains"}</small></span>
    <span class="row-end">${state.findings.filter((finding) => finding.programId === program.id).length} notes</span>
  </div>`;
}

function findingRow(finding) {
  const program = programFor(finding);
  return `<div class="finding-row">
    <span class="row-main"><strong>${safeText(finding.title)}</strong><small>${safeText(program?.name || "Program removed")} · ${safeText(finding.asset)}</small></span>
    <span class="row-end"><span class="severity-dot ${severityClass(finding.severity)}"></span>${safeText(finding.severity)}</span>
  </div>`;
}

function renderOverview() {
  const openCount = state.findings.filter((finding) => finding.status === "Open").length;
  const readyCount = state.findings.filter((finding) => finding.status === "Ready to report").length;
  $("#stat-programs").textContent = state.programs.length;
  $("#stat-assets").textContent = state.programs.reduce((total, program) => total + program.scope.length, 0);
  $("#stat-findings").textContent = openCount;
  $("#stat-reports").textContent = readyCount;
  $("#overview-programs").innerHTML = state.programs.length
    ? state.programs.slice(0, 4).map(programRow).join("")
    : emptyMessage("No programs yet", "Add an authorized program and record its scope before testing.");
  $("#overview-findings").innerHTML = state.findings.length
    ? [...state.findings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map(findingRow).join("")
    : emptyMessage("No findings yet", "Your documented research notes will appear here.");
}

function renderPrograms() {
  $("#all-programs").innerHTML = state.programs.length ? state.programs.map((program) => `
    <article class="program-card">
      <div class="program-card-top"><span class="program-icon">${safeText(initials(program.name))}</span><span class="row-main"><strong>${safeText(program.name)}</strong><small>${safeText(program.platform || "Private program")}</small></span></div>
      <div class="scope-list">${program.scope.map((domain) => `<span class="scope-chip">${safeText(domain)}</span>`).join("")}</div>
      ${program.rules ? `<div class="rules-note">${safeText(program.rules)}</div>` : `<div class="rules-note">No additional rules recorded.</div>`}
      <div class="eligibility-card"><span class="eligibility-status">${safeText(program.eligibility || "Not reviewed")}</span>${safeHttpsUrl(program.policyUrl || "") ? `<a href="${safeText(safeHttpsUrl(program.policyUrl))}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Official terms ↗</a>` : ""}${program.eligibilityNotes ? `<p>${safeText(program.eligibilityNotes)}</p>` : ""}</div>
      <div class="card-footer"><span>${state.findings.filter((finding) => finding.programId === program.id).length} findings · Added ${shortDate(program.createdAt)}</span><button class="small-link" data-delete-program="${safeText(program.id)}">Remove</button></div>
    </article>`).join("") : emptyMessage("Start with an authorized program", "Add its exact domains and any testing rules so your work stays within scope.");
}

function projectBrief(project) {
  const steps = project.tasks.map((task) => `- [${task.done ? "x" : " "}] ${task.text}`).join("\n");
  return `# Coding project: ${project.name}

## Stack
${project.stack || "Not specified"}

## Goal
${project.goal}

## Context and constraints
${project.notes || "No additional context provided."}

## Next steps
${steps || "- Break this goal into small, testable implementation steps."}

Please help me implement one next step at a time. Ask for the relevant files or missing requirements, preserve existing behavior, and include appropriate tests.`;
}

function renderProjects() {
  $("#all-projects").innerHTML = state.projects.length ? state.projects.map((project) => {
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const doneCount = tasks.filter((task) => task.done).length;
    return `<article class="project-card">
      <div class="project-card-header">
        <div><p class="eyebrow">${safeText(project.stack || "CODING PROJECT")}</p><h2>${safeText(project.name)}</h2></div>
        <button class="small-link" data-delete-project="${safeText(project.id)}">Remove</button>
      </div>
      <p class="project-goal">${safeText(project.goal)}</p>
      ${project.notes ? `<div class="project-notes">${safeText(project.notes)}</div>` : ""}
      <div class="project-tasks-heading"><strong>Next steps</strong><span>${doneCount}/${tasks.length} done</span></div>
      <div class="project-tasks">${tasks.length ? tasks.map((task) => `<div class="project-task ${task.done ? "done" : ""}">
        <button type="button" class="task-toggle" data-toggle-task="${safeText(project.id)}" data-task-id="${safeText(task.id)}" aria-label="${task.done ? "Mark incomplete" : "Mark complete"}">${task.done ? "✓" : ""}</button>
        <span>${safeText(task.text)}</span>
        <button type="button" class="task-remove" data-remove-task="${safeText(project.id)}" data-task-id="${safeText(task.id)}" aria-label="Remove task">×</button>
      </div>`).join("") : `<p class="project-no-tasks">Add a small, testable next step to get started.</p>`}</div>
      <form class="task-form" data-task-form="${safeText(project.id)}">
        <input name="task" maxlength="160" required aria-label="New project task" placeholder="Add a next step…">
        <button class="button button-secondary button-small" type="submit">Add</button>
      </form>
      <div class="project-actions"><button type="button" class="button button-secondary button-small" data-copy-brief="${safeText(project.id)}">Copy coding brief</button><button type="button" class="text-button" data-download-brief="${safeText(project.id)}">Download .md</button></div>
    </article>`;
  }).join("") : emptyMessage("No coding projects yet", "Add a project to break the work into manageable steps and create a coding brief.");
}

function renderFindings() {
  const query = $("#finding-search").value.trim().toLowerCase();
  const findings = [...state.findings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((finding) => {
      const program = programFor(finding);
      return [finding.title, finding.asset, finding.severity, finding.status, program?.name].some((value) => value?.toLowerCase().includes(query));
    });
  $("#finding-count").textContent = `${findings.length} ${findings.length === 1 ? "entry" : "entries"}`;
  $("#all-findings").innerHTML = findings.length ? `<table class="finding-table">
    <thead><tr><th>FINDING</th><th>PROGRAM</th><th>SEVERITY</th><th>STATUS</th><th>DATE</th><th></th></tr></thead>
    <tbody>${findings.map((finding) => `<tr>
      <td><span class="finding-title">${safeText(finding.title)}</span><br><span class="muted">${safeText(finding.asset)}</span></td>
      <td>${safeText(programFor(finding)?.name || "Program removed")}</td>
      <td><span class="badge sev-${severityClass(finding.severity)}">${safeText(finding.severity)}</span></td>
      <td><span class="badge status">${safeText(finding.status)}</span></td>
      <td>${shortDate(finding.createdAt)}</td>
      <td><button class="small-link" data-delete-finding="${safeText(finding.id)}">Remove</button></td>
    </tr>`).join("")}</tbody></table>` : `<div class="table-empty">${emptyMessage(query ? "No matching findings" : "No findings yet", query ? "Try a different search term." : "Create a finding after adding an authorized program.")}</div>`;
}

function reportMarkdown(finding) {
  const program = programFor(finding);
  return `# ${finding.title}

## Summary
${finding.description}

## Affected asset
${finding.asset}

## Severity
${finding.severity}

## Steps to reproduce
${finding.steps || "Add concise reproduction steps before submitting."}

## Impact and remediation
${finding.impact || "Add impact analysis and remediation guidance before submitting."}

## Program
${program?.name || "Program removed"}

---
Please review this draft, remove any sensitive information, and submit it only through the program's official disclosure channel.
`;
}

function renderReports() {
  const reports = [...state.findings].filter((finding) => finding.status === "Ready to report" || finding.status === "Submitted");
  if (!reports.some((finding) => finding.id === selectedReportId)) selectedReportId = null;
  $("#report-list").innerHTML = reports.length ? reports.map((finding) => `
    <button class="report-choice ${selectedReportId === finding.id ? "selected" : ""}" data-report="${safeText(finding.id)}">
      <strong>${safeText(finding.title)}</strong><small>${safeText(programFor(finding)?.name || "Program removed")} · ${safeText(finding.status)}</small>
    </button>`).join("") : emptyMessage("No report-ready findings", "Mark a finding “Ready to report” to create a draft.");
  const selected = reports.find((finding) => finding.id === selectedReportId);
  $("#report-preview").innerHTML = selected
    ? `<div>${safeText(reportMarkdown(selected))}</div>`
    : `<div class="empty-state"><span class="empty-symbol">▤</span><strong>Select a finding</strong><p>Choose a finding to preview its report.</p></div>`;
  $("#download-report").disabled = !selected;
}

function render() {
  renderOverview();
  renderPrograms();
  renderProjects();
  renderFindings();
  renderReports();
}

function navigate(view) {
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const title = { overview: "Overview", discover: "Discover", programs: "Programs", projects: "Code projects", findings: "Findings", reports: "Reports" }[view] || "Overview";
  $("#page-title").textContent = title;
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openFindingDialog() {
  const select = $("#finding-program");
  $("#finding-error").textContent = "";
  if (!state.programs.length) {
    notify("Add an authorized program before logging a finding.");
    navigate("programs");
    return;
  }
  select.innerHTML = state.programs.map((program) => `<option value="${safeText(program.id)}">${safeText(program.name)}</option>`).join("");
  $("#finding-dialog").showModal();
}

function hostFor(value) {
  try {
    const input = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(input).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function assetIsInScope(asset, scope) {
  const host = hostFor(asset);
  if (!host) return false;
  return scope.some((entry) => {
    const normalized = entry.toLowerCase().trim();
    if (normalized.startsWith("*.")) {
      const suffix = normalized.slice(1);
      return host.endsWith(suffix) && host !== suffix.slice(1);
    }
    return hostFor(normalized) === host;
  });
}

function id() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

$$(".nav-link").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
$$("[data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
$("#add-program").addEventListener("click", () => $("#program-dialog").showModal());
$("#add-program-overview").addEventListener("click", () => $("#program-dialog").showModal());
$("#add-program-discover").addEventListener("click", () => $("#program-dialog").showModal());
$("#add-project").addEventListener("click", () => {
  $("#project-error").textContent = "";
  $("#project-dialog").showModal();
});
$("#program-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const allowedDomains = new Set(["hackerone.com", "bugcrowd.com", "intigriti.com", "yeswehack.com"]);
  const domain = String(form.get("platform"));
  const query = String(form.get("query")).trim();
  if (!allowedDomains.has(domain) || !query) return;
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", `site:${domain} "bug bounty" ${query}`);
  $("#program-search-result").innerHTML = `Search generated for <strong>${safeText(query)}</strong>. <a href="${safeText(url.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open public search results ↗</a>`;
  $("#program-search-result").hidden = false;
});
$("#quick-add").addEventListener("click", openFindingDialog);
$("#add-finding").addEventListener("click", openFindingDialog);
$("#install-app").addEventListener("click", async () => {
  if (!installPrompt) {
    notify("Use your browser’s menu and choose “Install app” or “Add to Home Screen”.");
    return;
  }
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === "accepted") notify("ScopeSafe is being installed.");
  installPrompt = null;
});
$$("[data-close]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));

$("#program-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const policyUrlInput = String(form.get("policyUrl")).trim();
  const policyUrl = policyUrlInput ? safeHttpsUrl(policyUrlInput) : "";
  if (policyUrlInput && !policyUrl) {
    $("#program-error").textContent = "Enter a valid HTTPS link to the official program or policy page.";
    return;
  }
  const scope = String(form.get("scope")).split(/\r?\n/).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!scope.length) {
    $("#program-error").textContent = "Add at least one authorized domain to define the program’s scope.";
    return;
  }
  const invalidDomain = scope.find((domain) => !/^(\*\.)?(?=.{1,253}$)([a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i.test(domain));
  if (invalidDomain) {
    $("#program-error").textContent = `“${invalidDomain}” is not a valid domain or wildcard subdomain.`;
    return;
  }
  state.programs.push({
    id: id(),
    name: String(form.get("name")).trim(),
    platform: String(form.get("platform")).trim(),
    policyUrl,
    eligibility: String(form.get("eligibility")),
    eligibilityNotes: String(form.get("eligibilityNotes")).trim(),
    scope: [...new Set(scope)],
    rules: String(form.get("rules")).trim(),
    createdAt: new Date().toISOString()
  });
  saveState();
  render();
  event.currentTarget.reset();
  $("#program-dialog").close();
  notify("Program saved. Stay within its documented scope.");
});

$("#project-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.projects.push({
    id: id(),
    name: String(form.get("name")).trim(),
    stack: String(form.get("stack")).trim(),
    goal: String(form.get("goal")).trim(),
    notes: String(form.get("notes")).trim(),
    tasks: [],
    createdAt: new Date().toISOString()
  });
  saveState();
  render();
  event.currentTarget.reset();
  $("#project-dialog").close();
  navigate("projects");
  notify("Coding project saved on this device.");
});

$("#finding-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const program = state.programs.find((item) => item.id === form.get("programId"));
  const asset = String(form.get("asset")).trim();
  if (!program || !assetIsInScope(asset, program.scope)) {
    $("#finding-error").textContent = "That asset doesn’t match this program’s recorded scope. Check the domain and program rules.";
    return;
  }
  state.findings.push({
    id: id(),
    programId: program.id,
    title: String(form.get("title")).trim(),
    severity: String(form.get("severity")),
    status: String(form.get("status")),
    asset,
    description: String(form.get("description")).trim(),
    steps: String(form.get("steps")).trim(),
    impact: String(form.get("impact")).trim(),
    createdAt: new Date().toISOString()
  });
  saveState();
  render();
  event.currentTarget.reset();
  $("#finding-dialog").close();
  navigate("findings");
  notify("Finding saved to your local workspace.");
});

$("#finding-search").addEventListener("input", renderFindings);
$("#all-projects").addEventListener("submit", (event) => {
  const form = event.target.closest("[data-task-form]");
  if (!form) return;
  event.preventDefault();
  const project = state.projects.find((item) => item.id === form.dataset.taskForm);
  const text = String(new FormData(form).get("task")).trim();
  if (!project || !text) return;
  if (!Array.isArray(project.tasks)) project.tasks = [];
  project.tasks.push({ id: id(), text, done: false });
  saveState();
  render();
});
$("#all-projects").addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const project = state.projects.find((item) => item.id === (target.dataset.deleteProject || target.dataset.toggleTask || target.dataset.removeTask || target.dataset.copyBrief || target.dataset.downloadBrief));
  if (!project) return;

  if (target.dataset.deleteProject) {
    if (!confirm(`Remove coding project “${project.name}”?`)) return;
    state.projects = state.projects.filter((item) => item.id !== project.id);
    saveState();
    render();
    notify("Coding project removed.");
    return;
  }

  if (target.dataset.toggleTask || target.dataset.removeTask) {
    const taskIndex = project.tasks.findIndex((task) => task.id === target.dataset.taskId);
    if (taskIndex === -1) return;
    if (target.dataset.toggleTask) project.tasks[taskIndex].done = !project.tasks[taskIndex].done;
    else project.tasks.splice(taskIndex, 1);
    saveState();
    render();
    return;
  }

  if (target.dataset.copyBrief) {
    try {
      await navigator.clipboard.writeText(projectBrief(project));
      notify("Coding brief copied. Paste it into your coding assistant.");
    } catch (error) {
      notify(`Could not copy the brief: ${error.message}`);
    }
    return;
  }

  if (target.dataset.downloadBrief) {
    downloadText(projectBrief(project), `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "coding-project"}-brief.md`, "text/markdown;charset=utf-8");
  }
});
$("#all-programs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-program]");
  if (!button) return;
  const program = state.programs.find((item) => item.id === button.dataset.deleteProgram);
  if (!program || !confirm(`Remove “${program.name}”? Findings will be kept.`)) return;
  state.programs = state.programs.filter((item) => item.id !== program.id);
  saveState();
  render();
  notify("Program removed. Its findings were kept.");
});
$("#all-findings").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-finding]");
  if (!button) return;
  const finding = state.findings.find((item) => item.id === button.dataset.deleteFinding);
  if (!finding || !confirm(`Remove finding “${finding.title}”?`)) return;
  state.findings = state.findings.filter((item) => item.id !== finding.id);
  saveState();
  render();
  notify("Finding removed.");
});
$("#report-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-report]");
  if (!button) return;
  selectedReportId = button.dataset.report;
  renderReports();
});
$("#download-report").addEventListener("click", () => {
  const finding = state.findings.find((item) => item.id === selectedReportId);
  if (!finding) return;
  downloadText(reportMarkdown(finding), `${finding.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "finding-report"}.md`, "text/markdown;charset=utf-8");
});

function downloadText(contents, filename, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

loadState();
render();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  notify("ScopeSafe is installed on this device.");
});

if (window.Capacitor?.isNativePlatform()) {
  document.documentElement.classList.add("native-app");
}

if ("serviceWorker" in navigator && window.isSecureContext && !window.Capacitor?.isNativePlatform()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      showNotice(`Offline app setup failed: ${error.message}`);
    });
  });
}

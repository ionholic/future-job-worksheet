(function () {
  const originalTitle = document.title;

  function cleanFilename(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function worksheetType() {
    return document.body.dataset.worksheet === "group" ? "모둠활동지" : "개인활동지";
  }

  function printTitle() {
    const school = document.querySelector('[data-save="meta-school"]')?.value.trim();
    const team = document.querySelector('[data-save="meta-team"]')?.value.trim();
    const name = document.querySelector('[data-save="meta-name"]')?.value.trim();
    const parts = ["미래직업탐구", worksheetType(), school];
    if (document.body.dataset.worksheet === "group") parts.push(team);
    parts.push(name);
    return cleanFilename(parts.filter(Boolean).join("_")) || cleanFilename(originalTitle) || "활동지";
  }

  function valueLines(field) {
    const value = field.value.trim();
    if (value) return value;
    const rows = Math.max(Number(field.getAttribute("rows")) || 1, Math.round((field.offsetHeight || 26) / 26));
    return Array.from({ length: rows }, () => "\u00a0").join("\n");
  }

  function createPrintValue(field) {
    const value = document.createElement("div");
    value.className = `print-value ${field.tagName === "TEXTAREA" ? "multiline" : "singleline"}`;
    value.textContent = valueLines(field);
    field.insertAdjacentElement("afterend", value);
    return value;
  }

  function syncPrintValues() {
    document.querySelectorAll(".print-value").forEach((node) => node.remove());
    document.querySelectorAll(".fill-input, .fill-area").forEach((field) => {
      if (field.classList.contains("meta-input") || field.matches("[data-save]")) {
        createPrintValue(field);
      }
    });
  }

  function preparePrint() {
    syncPrintValues();
    document.title = printTitle();
    document.body.classList.add("print-ready");
  }

  function cleanupPrint() {
    document.body.classList.remove("print-ready");
    document.title = originalTitle;
  }

  function openPrintDialog() {
    preparePrint();
    window.setTimeout(() => window.print(), 50);
  }

  function initPdfExport() {
    window.prepareWorksheetPrint = preparePrint;
    window.downloadWorksheetPdf = openPrintDialog;
    document.querySelectorAll("[data-download-pdf]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openPrintDialog();
      });
    });
    window.addEventListener("beforeprint", preparePrint);
    window.addEventListener("afterprint", cleanupPrint);
  }

  window.prepareWorksheetPrint = preparePrint;
  window.downloadWorksheetPdf = openPrintDialog;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPdfExport);
  } else {
    initPdfExport();
  }
})();

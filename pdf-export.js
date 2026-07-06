(function () {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src.endsWith(src));
      if (existing?.dataset.loaded === "true") {
        resolve();
        return;
      }

      const script = existing || document.createElement("script");
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error(`${src} 파일을 불러오지 못했습니다.`));
      if (!existing) document.head.appendChild(script);
    });
  }

  async function ensurePdfLibraries() {
    if (!window.html2canvas) {
      await loadScript("vendor/html2canvas.min.js");
    }
    if (!window.jspdf?.jsPDF) {
      await loadScript("vendor/jspdf.umd.min.js");
    }
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      throw new Error("PDF 생성 도구를 사용할 수 없습니다.");
    }
  }

  function cleanFilename(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function worksheetName() {
    const title = document.querySelector("h1")?.innerText.trim() || document.title || "활동지";
    const school = document.querySelector('[data-save="meta-school"]')?.value.trim();
    const name = document.querySelector('[data-save="meta-name"]')?.value.trim();
    return cleanFilename([title, school, name].filter(Boolean).join("_")) || "활동지";
  }

  function setStatus(button, message) {
    button.dataset.originalText ||= button.textContent;
    button.textContent = message;
    button.disabled = true;
  }

  function resetStatus(button) {
    button.textContent = button.dataset.originalText || "PDF 바로 저장";
    button.disabled = false;
  }

  function expandTextareas() {
    const previous = [];
    document.querySelectorAll("textarea").forEach((field) => {
      previous.push([field, field.style.height, field.style.overflow]);
      field.style.height = "auto";
      field.style.height = `${Math.max(field.scrollHeight, field.offsetHeight)}px`;
      field.style.overflow = "hidden";
    });
    return () => {
      previous.forEach(([field, height, overflow]) => {
        field.style.height = height;
        field.style.overflow = overflow;
      });
    };
  }

  function preparePdfMode() {
    document.body.classList.add("pdf-export-mode");
    const restoreTextareas = expandTextareas();
    return () => {
      restoreTextareas();
      document.body.classList.remove("pdf-export-mode");
    };
  }

  function addCanvasPage(pdf, canvas, pageWidth, pageHeight, isFirstPage) {
    const pageCanvasHeight = Math.floor(canvas.width * (pageHeight / pageWidth));
    let sourceY = 0;

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const context = slice.getContext("2d");
      context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      if (!isFirstPage || sourceY > 0) pdf.addPage();
      const imageHeight = sliceHeight * pageWidth / canvas.width;
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageWidth, imageHeight);
      sourceY += sliceHeight;
      isFirstPage = false;
    }
    return false;
  }

  async function downloadPdf(button) {
    if (button.disabled) return;
    setStatus(button, "PDF 생성 중...");
    const restore = preparePdfMode();

    try {
      await ensurePdfLibraries();
      await document.fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let isFirstPage = true;

      for (const page of document.querySelectorAll(".page")) {
        const canvas = await window.html2canvas(page, {
          backgroundColor: "#ffffff",
          scale: Math.min(2, window.devicePixelRatio || 1.5),
          useCORS: true,
          allowTaint: false,
          scrollX: 0,
          scrollY: -window.scrollY
        });
        isFirstPage = addCanvasPage(pdf, canvas, pageWidth, pageHeight, isFirstPage);
      }

      pdf.save(`${worksheetName()}.pdf`);
    } catch (error) {
      console.error(error);
      window.alert("PDF 생성 중 오류가 발생했습니다. 인쇄 기능으로 PDF 저장을 시도해 주세요.");
    } finally {
      restore();
      resetStatus(button);
    }
  }

  function initPdfExport() {
    window.downloadWorksheetPdf = downloadPdf;
    document.querySelectorAll("[data-download-pdf]").forEach((button) => {
      button.addEventListener("click", () => downloadPdf(button));
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-download-pdf]");
      if (!button) return;
      event.preventDefault();
      downloadPdf(button);
    }, true);
  }

  window.downloadWorksheetPdf = downloadPdf;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPdfExport);
  } else {
    initPdfExport();
  }
})();

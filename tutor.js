(function () {
  const apiUrl = window.TUTOR_API_URL || "";

  function findQuestion(field) {
    const row = field.closest("tr");
    if (row?.querySelector("th")) return row.querySelector("th").innerText.trim();
    const card = field.closest(".answer-card, .answer-stack, .write-box");
    const title = card?.querySelector(".question-title, .write-head");
    return title?.innerText.trim() || field.getAttribute("aria-label") || "작성 항목";
  }

  function findSection(field) {
    const page = field.closest(".page");
    const heading = page?.querySelector("h1")?.innerText.trim();
    const box = field.closest(".write-box");
    const boxTitle = box?.querySelector(".write-head")?.innerText.trim();
    return [heading, boxTitle].filter(Boolean).join(" / ");
  }

  function selectedFields() {
    return Array.from(document.querySelectorAll("[data-save]")).filter((field) => {
      const value = field.value.trim();
      return value.length > 0 && !field.classList.contains("meta-input");
    });
  }

  function latestAnswer() {
    const active = document.activeElement?.matches?.("[data-save]") ? document.activeElement : null;
    const field = active || selectedFields().at(-1);
    if (!field) return null;
    return {
      field,
      answer: field.value.trim(),
      question: findQuestion(field),
      section: findSection(field)
    };
  }

  function createPanel() {
    const panel = document.createElement("aside");
    panel.className = "tutor-panel";
    panel.innerHTML = [
      '<div class="tutor-head">',
      "<strong>AI 작성 팁</strong>",
      '<button type="button" class="tutor-close" aria-label="AI 작성 팁 닫기">×</button>',
      "</div>",
      '<div class="tutor-body">작성 중인 칸을 클릭한 뒤 작성 팁을 받아보세요.</div>'
    ].join("");
    document.body.appendChild(panel);
    panel.querySelector(".tutor-close").addEventListener("click", () => panel.classList.remove("open"));
    return panel;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  function renderMarkdown(value) {
    const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let listType = "";

    function closeList() {
      if (!listType) return;
      html.push(`</${listType}>`);
      listType = "";
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }

      const bullet = line.match(/^[-*]\s+(.+)$/);
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      const numberedHeading = line.match(/^\d+\.\s+\*\*(.+?)\*\*$/) || line.match(/^\d+\.\s+(.+)$/);

      if (heading) {
        closeList();
        html.push(`<h3>${inlineMarkdown(heading[1])}</h3>`);
        continue;
      }

      if (numberedHeading && /\*\*.+?\*\*/.test(line)) {
        closeList();
        html.push(`<h3>${inlineMarkdown(numberedHeading[1])}</h3>`);
        continue;
      }

      if (bullet || numbered) {
        const nextType = "ul";
        if (listType !== nextType) {
          closeList();
          html.push(`<${nextType}>`);
          listType = nextType;
        }
        html.push(`<li>${inlineMarkdown((bullet || numbered)[1])}</li>`);
        continue;
      }

      closeList();
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    }

    closeList();
    return `<div class="tutor-markdown">${html.join("")}</div>`;
  }

  function showMessage(body, message) {
    body.innerHTML = `<div class="tutor-message">${escapeHtml(message)}</div>`;
  }

  async function requestTip(panel) {
    panel.classList.add("open");
    const body = panel.querySelector(".tutor-body");

    if (!apiUrl) {
      showMessage(body, "AI 튜터 API 주소가 아직 설정되지 않았습니다.");
      return;
    }

    const target = latestAnswer();
    if (!target) {
      showMessage(body, "먼저 도움을 받고 싶은 작성 칸에 내용을 조금 적어주세요.");
      return;
    }

    showMessage(body, "작성 팁을 불러오는 중입니다...");

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          worksheet: document.body.dataset.worksheet || "worksheet",
          section: target.section,
          question: target.question,
          answer: target.answer
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
      body.innerHTML = renderMarkdown(data.tip);
    } catch (error) {
      showMessage(body, error.message);
    }
  }

  function addButton() {
    if (!apiUrl) return;

    const actions = document.querySelector(".toolbar-actions");
    if (!actions || actions.querySelector("[data-tutor-tip]")) return;

    const button = document.createElement("button");
    button.className = "toolbar-button secondary";
    button.type = "button";
    button.dataset.tutorTip = "true";
    button.textContent = "AI 작성 팁";
    actions.prepend(button);

    const panel = createPanel();
    button.addEventListener("click", () => requestTip(panel));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButton);
  } else {
    addButton();
  }
})();

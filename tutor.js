(function () {
  const apiUrl = window.TUTOR_API_URL || "";

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function findQuestion(field) {
    const row = field.closest("tr");
    const cell = field.closest("td, th");
    const rowLabel = cleanText(row?.querySelector("th, .prepare-type")?.innerText);
    const headerCell = cell?.cellIndex >= 0
      ? field.closest("table")?.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`)
      : null;
    const columnLabel = cleanText(headerCell?.innerText);
    if (rowLabel && columnLabel && rowLabel !== columnLabel) return `${rowLabel} / ${columnLabel}`;
    if (rowLabel) return rowLabel;
    if (columnLabel) return columnLabel;
    const card = field.closest(".answer-card, .answer-stack, .write-box");
    const title = card?.querySelector(".question-title, .write-head");
    return cleanText(title?.innerText) || cleanText(field.getAttribute("aria-label")) || "작성 항목";
  }

  function findSection(field) {
    const page = field.closest(".page");
    const heading = cleanText(page?.querySelector("h1")?.innerText);
    const box = field.closest(".write-box");
    const boxTitle = cleanText(box?.querySelector(".write-head")?.innerText);
    return [heading, boxTitle].filter(Boolean).join(" / ");
  }

  function createPanel() {
    const panel = document.createElement("aside");
    panel.className = "tutor-panel";
    panel.innerHTML = [
      '<div class="tutor-head">',
      '<strong>AI 작성 팁</strong>',
      '<button type="button" class="tutor-close" aria-label="AI 작성 팁 닫기">×</button>',
      "</div>",
      '<div class="tutor-question">질문 옆 아이콘을 눌러 작성 팁을 받아보세요.</div>',
      '<div class="tutor-body"><div class="tutor-message">도움이 필요한 질문의 아이콘을 선택하세요.</div></div>'
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

  function getTarget(field) {
    return {
      field,
      answer: field.value.trim(),
      question: findQuestion(field),
      section: findSection(field)
    };
  }

  function getReferenceTarget(box) {
    const fields = Array.from(box.querySelectorAll("[data-save^='source-origin-'], [data-save^='source-note-']"));
    const rows = [];
    for (let index = 1; index <= 4; index += 1) {
      const origin = box.querySelector(`[data-save="source-origin-${index}"]`)?.value.trim();
      const note = box.querySelector(`[data-save="source-note-${index}"]`)?.value.trim();
      if (origin || note) rows.push(`${index}. 출처: ${origin || "(비어 있음)"} / 확인한 내용: ${note || "(비어 있음)"}`);
    }

    return {
      field: fields.find((field) => field.value.trim()) || fields[0],
      answer: rows.join("\n"),
      question: cleanText(box.querySelector(".write-head")?.innerText) || "참고한 자료 기록하기",
      section: findSection(box.querySelector("[data-save]"))
    };
  }

  function collectIndexedValues(selectorPrefix, label) {
    const rows = [];
    for (let index = 1; index <= 8; index += 1) {
      const field = document.querySelector(`[data-save="${selectorPrefix}${index}"]`);
      if (!field) continue;
      const value = field.value.trim();
      if (value) rows.push(`${index}. ${label}: ${value}`);
    }
    return rows;
  }

  function getKeywordTarget(card, prefix, fallbackQuestion) {
    const fields = Array.from(card.querySelectorAll(`[data-save^="${prefix}"]`));
    return {
      field: fields.find((field) => field.value.trim()) || fields[0],
      answer: collectIndexedValues(prefix, "키워드").join("\n"),
      question: cleanText(card.querySelector(".question-title")?.innerText) || fallbackQuestion,
      section: findSection(fields[0])
    };
  }

  function getCandidateTarget(box) {
    const fields = Array.from(box.querySelectorAll("[data-save^='page3-candidate-'], [data-save^='page3-reason-']"));
    const rows = [];
    for (let index = 1; index <= 6; index += 1) {
      const candidate = box.querySelector(`[data-save="page3-candidate-${index}"]`)?.value.trim();
      const reason = box.querySelector(`[data-save="page3-reason-${index}"]`)?.value.trim();
      if (candidate || reason) rows.push(`${index}. 직업군/일: ${candidate || "(비어 있음)"} / 이유: ${reason || "(비어 있음)"}`);
    }

    return {
      field: fields.find((field) => field.value.trim()) || fields[0],
      answer: rows.join("\n"),
      question: cleanText(box.querySelector(".write-head")?.innerText) || "조사하고 싶은 직업군 / 일과 이유",
      section: findSection(fields[0])
    };
  }

  function createIconButton(panel, targetFactory) {
    const button = document.createElement("button");
    button.className = "tutor-field-button";
    button.type = "button";
    button.title = "이 질문 AI 작성 팁";
    button.setAttribute("aria-label", "이 질문 AI 작성 팁 보기");
    button.innerHTML = iconSvg();
    button.addEventListener("click", () => requestTip(panel, targetFactory()));
    return button;
  }

  async function requestTip(panel, target) {
    panel.classList.add("open");
    const body = panel.querySelector(".tutor-body");
    const questionLine = panel.querySelector(".tutor-question");

    if (!apiUrl) {
      showMessage(body, "AI 튜터 API 주소가 아직 설정되지 않았습니다.");
      return;
    }

    if (!target) {
      showMessage(body, "먼저 도움을 받고 싶은 작성 칸에 내용을 조금 적어주세요.");
      return;
    }

    questionLine.textContent = target.question;

    if (!target.answer) {
      showMessage(body, "먼저 이 칸에 생각을 조금 적어주세요.");
      target.field.focus();
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
    addFieldButtons();
  }

  function iconSvg() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M12 3l1.6 4.2L18 8.8l-4.4 1.6L12 15l-1.6-4.6L6 8.8l4.4-1.6L12 3z"></path>',
      '<path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z"></path>',
      '</svg>'
    ].join("");
  }

  function addFieldButtons() {
    const panel = createPanel();
    addReferenceTableButton(panel);
    addGroupWorksheetButtons(panel);

    const fields = Array.from(document.querySelectorAll("[data-save]")).filter((field) => {
      return !field.classList.contains("meta-input")
        && !field.closest(".meta-line")
        && !field.closest(".tutor-field-wrap")
        && !field.matches("[data-save^='source-origin-'], [data-save^='source-note-']")
        && !field.matches("[data-save^='page1-decrease-keyword-'], [data-save^='page1-new-keyword-']")
        && !field.matches("[data-save^='page3-candidate-'], [data-save^='page3-reason-']");
    });

    for (const field of fields) {
      const wrapper = document.createElement("span");
      wrapper.className = "tutor-field-wrap";
      field.parentNode.insertBefore(wrapper, field);
      wrapper.appendChild(field);

      wrapper.appendChild(createIconButton(panel, () => getTarget(field)));
    }
  }

  function addReferenceTableButton(panel) {
    const firstField = document.querySelector("[data-save='source-origin-1']");
    const box = firstField?.closest(".write-box");
    if (!box || box.querySelector("[data-reference-tutor]")) return;

    const head = box.querySelector(".write-head");
    if (head) {
      const button = createIconButton(panel, () => getReferenceTarget(box));
      button.dataset.referenceTutor = "true";
      button.classList.add("tutor-heading-button");
      head.appendChild(button);
      return;
    }

    const wrapper = document.createElement("span");
    wrapper.className = "tutor-field-wrap";
    firstField.parentNode.insertBefore(wrapper, firstField);
    wrapper.appendChild(firstField);
    const button = createIconButton(panel, () => getReferenceTarget(box));
    button.dataset.referenceTutor = "true";
    wrapper.appendChild(button);
  }

  function appendHeadingButton(container, button) {
    button.classList.add("tutor-heading-button");
    container.appendChild(button);
  }

  function addGroupWorksheetButtons(panel) {
    const decreaseField = document.querySelector("[data-save='page1-decrease-keyword-1']");
    const decreaseCard = decreaseField?.closest(".answer-card");
    const decreaseTitle = decreaseCard?.querySelector(".question-title");
    if (decreaseCard && decreaseTitle && !decreaseCard.querySelector("[data-group-tutor='decrease']")) {
      const button = createIconButton(panel, () => getKeywordTarget(decreaseCard, "page1-decrease-keyword-", "사라지거나 줄어들 것으로 예상되는 직업"));
      button.dataset.groupTutor = "decrease";
      appendHeadingButton(decreaseTitle, button);
    }

    const newField = document.querySelector("[data-save='page1-new-keyword-1']");
    const newCard = newField?.closest(".answer-card");
    const newTitle = newCard?.querySelector(".question-title");
    if (newCard && newTitle && !newCard.querySelector("[data-group-tutor='new']")) {
      const button = createIconButton(panel, () => getKeywordTarget(newCard, "page1-new-keyword-", "새롭게 생겨날 직업"));
      button.dataset.groupTutor = "new";
      appendHeadingButton(newTitle, button);
    }

    const candidateField = document.querySelector("[data-save='page3-candidate-1']");
    const candidateBox = candidateField?.closest(".write-box");
    const candidateHead = candidateBox?.querySelector(".write-head");
    if (candidateBox && candidateHead && !candidateBox.querySelector("[data-group-tutor='candidate']")) {
      const button = createIconButton(panel, () => getCandidateTarget(candidateBox));
      button.dataset.groupTutor = "candidate";
      appendHeadingButton(candidateHead, button);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButton);
  } else {
    addButton();
  }
})();

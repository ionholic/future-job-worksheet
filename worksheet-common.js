(function () {
  const GROUP_PREFIX = "future-job-worksheet-v0:";
  const PERSONAL_PREFIX = "future-job-personal-worksheet-v0:";
  const UPDATED_SUFFIX = "__updatedAt";

  function isGroupWorksheet() {
    return document.body.dataset.worksheet === "group";
  }

  function activePrefix() {
    return isGroupWorksheet() ? GROUP_PREFIX : PERSONAL_PREFIX;
  }

  function cleanFilenamePart(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .trim();
  }

  function showToast(message) {
    let toast = document.querySelector(".toast-banner");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast-banner";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 2600);
  }

  function autoResize(textarea) {
    if (!textarea || textarea.tagName !== "TEXTAREA") return;
    textarea.style.height = "auto";
    const nextHeight = Math.max(textarea.scrollHeight, 52);
    textarea.style.height = `${nextHeight}px`;
  }

  function resizeAllTextareas(fields) {
    fields.forEach((field) => {
      if (field.tagName === "TEXTAREA") autoResize(field);
    });
  }

  function updateProgress(fields) {
    const badge = document.querySelector("[data-progress-badge]");
    if (!badge) return;
    const contentFields = Array.from(fields).filter(
      (field) => !field.dataset.save.startsWith("meta-")
    );
    const filled = contentFields.filter((field) => field.value.trim().length > 0).length;
    badge.textContent = `작성 ${filled}/${contentFields.length}`;
  }

  function saveField(prefix, field) {
    localStorage.setItem(prefix + field.dataset.save, field.value);
    localStorage.setItem(prefix + UPDATED_SUFFIX, new Date().toISOString());
  }

  function buildPayload(fields) {
    const raw = Object.fromEntries(
      Array.from(fields).map((field) => [field.dataset.save, field.value.trim()])
    );
    const metadata = {
      school: raw["meta-school"] || "",
      team: raw["meta-team"] || "",
      name: raw["meta-name"] || "",
      date: raw["meta-date"] || ""
    };

    if (isGroupWorksheet()) {
      return {
        schemaVersion: "future-job-report-input-v1",
        worksheet: { session: "05", type: "group" },
        exportedAt: new Date().toISOString(),
        metadata,
        groupPlanning: {
          jobsLikelyReduced: [1, 2, 3, 4]
            .map((n) => raw[`page1-decrease-keyword-${n}`])
            .filter(Boolean),
          jobsNew: [1, 2, 3, 4]
            .map((n) => raw[`page1-new-keyword-${n}`])
            .filter(Boolean),
          importantSkill: raw["page2-skill-choice"] || "",
          skillReason: raw["page2-skill-reason"] || "",
          candidates: [1, 2, 3, 4, 5, 6]
            .map((n) => ({
              job: raw[`page3-candidate-${n}`] || "",
              reason: raw[`page3-reason-${n}`] || ""
            }))
            .filter((item) => item.job || item.reason)
        },
        careerResearch: null,
        raw
      };
    }

    return {
      schemaVersion: "future-job-report-input-v1",
      worksheet: { session: "06", type: "individual" },
      exportedAt: new Date().toISOString(),
      metadata,
      groupPlanning: null,
      careerResearch: {
        job: raw["topic-job"] || "",
        reason: raw["topic-reason"] || "",
        sources: [1, 2, 3, 4]
          .map((n) => ({
            origin: raw[`source-origin-${n}`] || "",
            note: raw[`source-note-${n}`] || ""
          }))
          .filter((item) => item.origin || item.note),
        currentWork: raw["current-work"] || "",
        currentRequirements: raw["current-requirements"] || "",
        aiReducedWork: raw["ai-reduced-work"] || "",
        aiBigChange: raw["ai-big-change"] || "",
        humanJudgement: raw["human-judgement"] || "",
        humanRole: raw["human-role"] || "",
        futureSkill: raw["future-skill"] || "",
        preparation: [1, 2]
          .map((n) => raw[`prepare-method-${n}`])
          .filter(Boolean),
        coreSentence: raw["core-sentence"] || ""
      },
      raw
    };
  }

  function downloadJson(fields) {
    const payload = buildPayload(fields);
    const meta = payload.metadata;
    const filename = isGroupWorksheet()
      ? `미래직업탐구_05차시_모둠_${cleanFilenamePart(meta.team || meta.name || "입력")}.json`
      : `미래직업탐구_06차시_개인_${cleanFilenamePart(meta.name || "입력")}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast("JSON 인풋데이터를 저장했습니다.");
  }

  function applyRawToFields(prefix, fields, raw) {
    fields.forEach((field) => {
      const key = field.dataset.save;
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        field.value = String(raw[key] || "");
        localStorage.setItem(prefix + key, field.value);
      }
    });
    localStorage.setItem(prefix + UPDATED_SUFFIX, new Date().toISOString());
    resizeAllTextareas(fields);
    updateProgress(fields);
    syncSkillHighlights();
  }

  function extractRawFromStructured(data) {
    const raw = {};
    if (data.metadata) {
      if (data.metadata.school) raw["meta-school"] = data.metadata.school;
      if (data.metadata.team) raw["meta-team"] = data.metadata.team;
      if (data.metadata.name) raw["meta-name"] = data.metadata.name;
      if (data.metadata.date) raw["meta-date"] = data.metadata.date;
    }

    if (isGroupWorksheet() && data.groupPlanning) {
      const gp = data.groupPlanning;
      (gp.jobsLikelyReduced || []).slice(0, 4).forEach((v, i) => {
        raw[`page1-decrease-keyword-${i + 1}`] = v;
      });
      (gp.jobsNew || []).slice(0, 4).forEach((v, i) => {
        raw[`page1-new-keyword-${i + 1}`] = v;
      });
      if (gp.importantSkill) raw["page2-skill-choice"] = gp.importantSkill;
      if (gp.skillReason) raw["page2-skill-reason"] = gp.skillReason;
      (gp.candidates || []).slice(0, 6).forEach((item, i) => {
        raw[`page3-candidate-${i + 1}`] = item.job || "";
        raw[`page3-reason-${i + 1}`] = item.reason || "";
      });
    } else if (!isGroupWorksheet() && data.careerResearch) {
      const cr = data.careerResearch;
      if (cr.job) raw["topic-job"] = cr.job;
      if (cr.reason) raw["topic-reason"] = cr.reason;
      (cr.sources || []).slice(0, 4).forEach((s, i) => {
        raw[`source-origin-${i + 1}`] = s.origin || "";
        raw[`source-note-${i + 1}`] = s.note || "";
      });
      if (cr.currentWork) raw["current-work"] = cr.currentWork;
      if (cr.currentRequirements) raw["current-requirements"] = cr.currentRequirements;
      if (cr.aiReducedWork) raw["ai-reduced-work"] = cr.aiReducedWork;
      if (cr.aiBigChange) raw["ai-big-change"] = cr.aiBigChange;
      if (cr.humanJudgement) raw["human-judgement"] = cr.humanJudgement;
      if (cr.humanRole) raw["human-role"] = cr.humanRole;
      if (cr.futureSkill) raw["future-skill"] = cr.futureSkill;
      (cr.preparation || []).slice(0, 2).forEach((p, i) => {
        raw[`prepare-method-${i + 1}`] = p;
      });
      if (cr.coreSentence) raw["core-sentence"] = cr.coreSentence;
    }
    return raw;
  }

  function renderGroupSyncBanner(prefix, fields, sourceData) {
    const banner = document.querySelector("[data-group-sync]");
    if (!banner || isGroupWorksheet()) return;

    const candidates = (sourceData?.candidates || []).filter((item) => item.job || item.reason);
    const hasMeta = Boolean(sourceData?.school || sourceData?.team || sourceData?.date);
    if (!candidates.length && !hasMeta) {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    banner.innerHTML = "";

    const head = document.createElement("div");
    head.className = "group-sync-head";
    const title = document.createElement("strong");
    title.textContent = sourceData.fromFile
      ? "불러온 05차시 모둠 데이터에서 직업 후보를 선택해 채울 수 있습니다."
      : "이 브라우저에 저장된 05차시 모둠 활동지 데이터와 연결할 수 있습니다.";
    head.appendChild(title);

    if (hasMeta) {
      const metaBtn = document.createElement("button");
      metaBtn.type = "button";
      metaBtn.className = "sync-chip primary";
      metaBtn.textContent = "학교·모둠·날짜 가져오기";
      metaBtn.addEventListener("click", () => {
        const map = {
          "meta-school": sourceData.school || "",
          "meta-team": sourceData.team || "",
          "meta-date": sourceData.date || ""
        };
        fields.forEach((field) => {
          const key = field.dataset.save;
          if (map[key]) {
            field.value = map[key];
            saveField(prefix, field);
          }
        });
        updateProgress(fields);
        showToast("모둠 기본 정보를 가져왔습니다.");
      });
      head.appendChild(metaBtn);
    }

    banner.appendChild(head);

    if (candidates.length) {
      const chips = document.createElement("div");
      chips.className = "group-sync-chips";
      candidates.forEach((cand) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sync-chip";
        btn.textContent = cand.job ? `탐구 후보: ${cand.job}` : "직업 후보 선택";
        btn.title = cand.reason || "";
        btn.addEventListener("click", () => {
          const jobField = document.querySelector('[data-save="topic-job"]');
          const reasonField = document.querySelector('[data-save="topic-reason"]');
          if (jobField && cand.job) {
            jobField.value = cand.job;
            saveField(prefix, jobField);
          }
          if (reasonField && cand.reason) {
            reasonField.value = cand.reason;
            autoResize(reasonField);
            saveField(prefix, reasonField);
          }
          updateProgress(fields);
          showToast(`"${cand.job || "직업 후보"}" 내용을 채웠습니다.`);
        });
        chips.appendChild(btn);
      });
      banner.appendChild(chips);
    }
  }

  function readStoredGroupData() {
    const school = (localStorage.getItem(GROUP_PREFIX + "meta-school") || "").trim();
    const team = (localStorage.getItem(GROUP_PREFIX + "meta-team") || "").trim();
    const date = (localStorage.getItem(GROUP_PREFIX + "meta-date") || "").trim();
    const candidates = [];
    for (let i = 1; i <= 6; i += 1) {
      const job = (localStorage.getItem(`${GROUP_PREFIX}page3-candidate-${i}`) || "").trim();
      const reason = (localStorage.getItem(`${GROUP_PREFIX}page3-reason-${i}`) || "").trim();
      if (job || reason) candidates.push({ job, reason });
    }
    return { school, team, date, candidates, fromFile: false };
  }

  function handleImportedJson(prefix, fields, text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      window.alert("올바른 JSON 파일이 아닙니다.");
      return;
    }

    if (!data || data.schemaVersion !== "future-job-report-input-v1") {
      window.alert("미래직업탐구 활동지 JSON 형식(future-job-report-input-v1)이 아닙니다.");
      return;
    }

    const incomingType = data.worksheet?.type;
    const currentType = isGroupWorksheet() ? "group" : "individual";

    if (incomingType && incomingType !== currentType) {
      if (currentType === "individual" && incomingType === "group") {
        const gp = data.groupPlanning || {};
        const meta = data.metadata || {};
        renderGroupSyncBanner(prefix, fields, {
          school: meta.school || data.raw?.["meta-school"] || "",
          team: meta.team || data.raw?.["meta-team"] || "",
          date: meta.date || data.raw?.["meta-date"] || "",
          candidates: gp.candidates || [],
          fromFile: true
        });
        showToast("05차시 모둠 데이터를 상단 연동 패널에 불러왔습니다.");
        return;
      }
      window.alert("현재 활동지와 다른 차시의 JSON 파일입니다. 05차시는 모둠 활동지, 06차시는 개인 활동지에서 불러와 주세요.");
      return;
    }

    const raw = data.raw && typeof data.raw === "object"
      ? data.raw
      : extractRawFromStructured(data);

    applyRawToFields(prefix, fields, raw);
    showToast("저장된 JSON 데이터를 활동지에 불러왔습니다.");
  }

  function parseSkillTokens(value) {
    return String(value || "")
      .split(/[,/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function syncSkillHighlights() {
    if (!isGroupWorksheet()) return;
    const choiceField = document.querySelector('[data-save="page2-skill-choice"]');
    const hits = document.querySelectorAll(".skill-hit[data-skill]");
    if (!choiceField || !hits.length) return;

    const currentText = choiceField.value;
    hits.forEach((hit) => {
      const skill = hit.dataset.skill;
      const selected = currentText.includes(skill);
      hit.classList.toggle("selected", selected);
      hit.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function initSkillCardInteractions(prefix, fields) {
    if (!isGroupWorksheet()) return;
    const choiceField = document.querySelector('[data-save="page2-skill-choice"]');
    const hits = document.querySelectorAll(".skill-hit[data-skill]");
    if (!choiceField || !hits.length) return;

    function toggleSkill(skill) {
      const tokens = parseSkillTokens(choiceField.value);
      const idx = tokens.indexOf(skill);
      if (idx >= 0) {
        tokens.splice(idx, 1);
      } else {
        tokens.push(skill);
      }
      choiceField.value = tokens.join(", ");
      autoResize(choiceField);
      saveField(prefix, choiceField);
      updateProgress(fields);
      syncSkillHighlights();
    }

    hits.forEach((hit) => {
      hit.addEventListener("click", () => toggleSkill(hit.dataset.skill));
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSkill(hit.dataset.skill);
        }
      });
    });

    choiceField.addEventListener("input", syncSkillHighlights);
    syncSkillHighlights();
  }

  function init() {
    const prefix = activePrefix();
    const fields = document.querySelectorAll("[data-save]");

    fields.forEach((field) => {
      const savedValue = localStorage.getItem(prefix + field.dataset.save);
      if (savedValue !== null) {
        field.value = savedValue;
      }
      field.addEventListener("input", () => {
        saveField(prefix, field);
        autoResize(field);
        updateProgress(fields);
      });
    });

    resizeAllTextareas(fields);
    updateProgress(fields);
    initSkillCardInteractions(prefix, fields);

    if (!isGroupWorksheet()) {
      renderGroupSyncBanner(prefix, fields, readStoredGroupData());
    }

    const jsonButton = document.querySelector("[data-download-json]");
    jsonButton?.addEventListener("click", () => downloadJson(fields));

    const importButton = document.querySelector("[data-import-json]");
    if (importButton) {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.hidden = true;
      document.body.appendChild(fileInput);

      importButton.addEventListener("click", () => {
        fileInput.value = "";
        fileInput.click();
      });

      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => handleImportedJson(prefix, fields, String(reader.result || ""));
        reader.readAsText(file, "utf-8");
      });
    }

    const clearButton = document.querySelector("[data-clear-form]");
    clearButton?.addEventListener("click", () => {
      const confirmed = window.confirm("현재 브라우저에 저장된 입력 내용을 모두 지울까요?");
      if (!confirmed) return;
      fields.forEach((field) => {
        localStorage.removeItem(prefix + field.dataset.save);
        field.value = "";
        if (field.tagName === "TEXTAREA") {
          field.style.height = "";
        }
      });
      localStorage.removeItem(prefix + UPDATED_SUFFIX);
      updateProgress(fields);
      syncSkillHighlights();
      showToast("입력 내용을 초기화했습니다.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

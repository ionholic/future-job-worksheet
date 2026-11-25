const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

const MAX_BODY_BYTES = 12288;

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, env) {
  const allowedOrigins = getAllowedOrigins(env);
  if (!allowedOrigins.length) return false;
  if (allowedOrigins.includes("*")) return true;
  return Boolean(origin && allowedOrigins.includes(origin));
}

function corsHeaders(origin, env) {
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = isOriginAllowed(origin, env)
    ? origin || "*"
    : allowedOrigins[0] || "null";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(origin, env)
    }
  });
}

function sanitizeText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function includesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function classifyQuestion({ worksheet, section, question, answer }) {
  const text = `${section} ${question} ${answer}`;

  if (includesAny(text, ["참고한 자료", "출처", "확인한 내용"])) {
    return "reference";
  }

  if (
    worksheet === "group" &&
    includesAny(text, ["사라지거나 줄어들", "새롭게 생겨날", "업무가 줄거나", "새롭게 등장하거나"])
  ) {
    return "groupKeywords";
  }

  if (worksheet === "group" && includesAny(text, ["조사하고 싶은 직업군", "직업군/일:"])) {
    return "groupCandidates";
  }

  if (includesAny(text, ["진로를 위한 준비", "길러야 할 역량", "경험 쌓기"])) {
    return "careerPrep";
  }

  if (includesAny(text, ["내가 탐구할 직업", "직업 또는 진로", "키워드", "직업명"])) {
    return "shortAnswer";
  }

  return "essay";
}

const QUESTION_TYPE_GUIDES = {
  reference: [
    "- 자료 기록형 질문이다. 출처(기관·자료명·연도·링크)가 구체적인지, 확인한 내용이 출처와 연결되는지 점검한다.",
    "- 빈칸이면 믿을 만한 진로·고용 통계 자료 유형(예: 워크넷, 커리어넷, 한국고용정보원)과 기록 예시를 제시한다.",
    "- 확인한 내용은 긴 설명보다 핵심 사실, 통계, 업무 변화 이유처럼 발표 근거로 쓸 수 있는 내용으로 안내한다."
  ].join("\n"),
  groupKeywords: [
    "- 모둠이 낸 여러 키워드를 종합해 보는 질문이다.",
    "- 직업 전체가 사라진다고 단정하기보다 어떤 반복 업무가 줄고 어떤 역할이 새로 생기는지 관점을 넓히도록 돕는다.",
    "- 단답형 키워드에 맞게 직업명이나 변화 포인트를 짧고 분명하게 보완하도록 안내한다."
  ].join("\n"),
  groupCandidates: [
    "- 조사하고 싶은 직업군을 고르는 질문이다.",
    "- 직업군과 선택 이유가 서로 맞는지, AI 변화와 연결해 탐구할 가치가 있는지 점검한다.",
    "- 추천 예시는 직업군/일과 선택 이유가 함께 보이도록 짧게 제시한다."
  ].join("\n"),
  careerPrep: [
    "- 진로 준비 계획을 쓰는 질문이다.",
    "- 길러야 할 역량, 자격증/교육, 경험 쌓기처럼 학생이 지금 실천할 수 있는 준비를 중심으로 안내한다.",
    "- 추상적인 다짐보다 구체적인 활동, 배울 내용, 경험 방법이 들어가도록 돕는다."
  ].join("\n"),
  shortAnswer: [
    "- 단답 또는 짧은 구문으로 답하는 질문이다.",
    "- 학생 답이 적절하면 왜 맞는지 짧게 설명하고, 구체화할 수 있는 보충 키워드나 유사 예시를 덧붙인다.",
    "- 추천 예시는 한두 문장 이하로 간결하게 제시한다."
  ].join("\n"),
  essay: [
    "- 서술형 질문이다.",
    "- 주장만 쓰지 않도록 이유, 근거, 구체적 업무 예시, AI와 인간 역할 비교 중 필요한 요소를 보완하게 한다.",
    "- 추천 예시는 학생이 자기 말로 바꿔 쓸 수 있는 참고용 문장으로 제시한다."
  ].join("\n")
};

function buildContextLines(context) {
  if (!context) return [];
  const lines = [];
  if (context.job) lines.push(`학생이 탐구 중인 직업: ${context.job}`);
  if (context.jobReason) lines.push(`직업 선택 이유: ${context.jobReason}`);
  if (context.selectedSkill) lines.push(`모둠이 고른 중요 역량: ${context.selectedSkill}`);
  return lines;
}

function buildPrompt({ worksheet, section, question, answer, context }) {
  const worksheetName = worksheet === "group" ? "모둠 활동지(05차시)" : "개인 활동지(06차시)";
  const hasAnswer = Boolean(answer);
  const questionType = classifyQuestion({ worksheet, section, question, answer });
  const typeGuide = QUESTION_TYPE_GUIDES[questionType] || QUESTION_TYPE_GUIDES.essay;
  const contextLines = buildContextLines(context);

  const outputFormat = hasAnswer
    ? [
        "출력 형식:",
        "아래 Markdown 형식을 정확히 지킨다.",
        "### 답변 점검",
        "- 학생 답이 질문에 맞는 부분과 좋은 점, 부족한 부분을 1~2문장으로 점검한다.",
        "",
        "### 보완 힌트",
        "- 더 구체화하거나 근거를 추가할 점을 1~2개 bullet으로 제시한다.",
        "",
        "### 추천 답변",
        "- 학생 답을 바탕으로 더 나은 형태의 참고용 예시를 1~2개 제시한다."
      ]
    : [
        "출력 형식:",
        "학생이 아직 칸을 작성하지 않은 상태다. 아래 Markdown 형식을 정확히 지킨다.",
        "### 작성 방향",
        "- 이 질문에서 무엇을 중심으로 쓰면 되는지 1~2문장으로 쉽게 설명한다.",
        "",
        "### 생각 열기 질문",
        "- 학생이 스스로 떠올릴 수 있도록 짧은 질문 2개를 bullet으로 던진다.",
        "",
        "### 참고 예시",
        "- 빈칸을 채울 때 참고할 수 있는 짧은 예시를 1~2개 제시한다."
      ];

  return [
    "너는 중고등학생의 미래직업탐구 보고서 작성을 돕는 AI 튜터다.",
    `대상 활동지: ${worksheetName}`,
    `활동 영역: ${section || "미지정"}`,
    `질문: ${question || "미지정"}`,
    ...contextLines,
    `학생 답변 상태: ${hasAnswer ? "작성됨" : "작성 전(빈칸)"}`,
    `학생이 작성한 내용: ${answer || "(아직 작성하지 않음)"}`,
    "",
    "핵심 원칙:",
    "- 학생 답을 대신 완성하는 것이 아니라, 스스로 생각하고 보완할 수 있도록 돕는다.",
    "- 참고 예시는 그대로 베끼지 않고 자기 말로 바꿔 쓰도록 안내한다.",
    "- 탐구 중인 직업 문맥이 주어지면 그 직업의 실제 업무에 맞춰 구체적으로 조언한다.",
    "- AI가 직업 전체를 없앤다고 단정하지 말고, 업무 변화와 인간의 역할 관점으로 안내한다.",
    "- 학교명, 이름 등 개인정보를 요구하지 않는다.",
    "- 사실 확인이 필요한 통계나 내용은 출처 자료를 다시 확인하라고 안내한다.",
    "- 한국어로 짧고 친절하며 구체적으로 답한다. 전체 답변은 8문장 이내로 제한한다.",
    "",
    "질문 유형별 지침:",
    typeGuide,
    "",
    ...outputFormat
  ].join("\n");
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw Object.assign(new Error("JSON 요청만 지원합니다."), { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error("요청 크기가 허용 한도를 초과했습니다."), { status: 413 });
  }

  const rawText = await request.text();
  if (new TextEncoder().encode(rawText).length > MAX_BODY_BYTES) {
    throw Object.assign(new Error("요청 크기가 허용 한도를 초과했습니다."), { status: 413 });
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    throw Object.assign(new Error("JSON 형식이 올바르지 않습니다."), { status: 400 });
  }

  const rawContext = body && typeof body.context === "object" && body.context ? body.context : {};

  return {
    worksheet: sanitizeText(body.worksheet, 20),
    section: sanitizeText(body.section, 100),
    question: sanitizeText(body.question, 180),
    answer: sanitizeText(body.answer, 2000),
    context: {
      job: sanitizeText(rawContext.job, 80),
      jobReason: sanitizeText(rawContext.jobReason, 240),
      selectedSkill: sanitizeText(rawContext.selectedSkill, 120)
    }
  };
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const parts = [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      if (typeof block.text === "string" && block.text.trim()) {
        parts.push(block.text.trim());
      }
    }
  }
  return parts.join("\n\n").trim();
}

async function callResponsesApi(apiKey, model, prompt) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 900
    })
  });
}

function shouldFallbackModel(status, errorText) {
  if (status === 404) return true;
  if (status === 400 && /model|does not exist|not found|unsupported/i.test(errorText)) {
    return true;
  }
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";

    if (!isOriginAllowed(origin, env)) {
      return jsonResponse({ error: "허용되지 않은 출처에서의 요청입니다." }, 403, origin, env);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "POST 요청만 지원합니다." }, 405, origin, env);
    }

    if (!env.OPENAI_API_KEY) {
      return jsonResponse({ error: "AI 튜터 API 키가 아직 설정되지 않았습니다." }, 503, origin, env);
    }

    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      return jsonResponse({ error: error.message }, error.status || 400, origin, env);
    }

    const prompt = buildPrompt(payload);
    const primaryModel = sanitizeText(env.MODEL, 64) || "gpt-6-luna";
    const fallbackModel = sanitizeText(env.FALLBACK_MODEL, 64) || "gpt-5.4-mini";

    try {
      let usedModel = primaryModel;
      let openaiResponse = await callResponsesApi(env.OPENAI_API_KEY, usedModel, prompt);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        if (fallbackModel && fallbackModel !== usedModel && shouldFallbackModel(openaiResponse.status, errorText)) {
          console.warn(JSON.stringify({ fallbackFrom: usedModel, fallbackTo: fallbackModel, status: openaiResponse.status }));
          usedModel = fallbackModel;
          openaiResponse = await callResponsesApi(env.OPENAI_API_KEY, usedModel, prompt);
        } else {
          console.error(JSON.stringify({ model: usedModel, status: openaiResponse.status, error: errorText.slice(0, 500) }));
          return jsonResponse({ error: "AI 튜터 응답을 가져오지 못했습니다." }, 502, origin, env);
        }
      }

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(JSON.stringify({ model: usedModel, status: openaiResponse.status, error: errorText.slice(0, 500) }));
        return jsonResponse({ error: "AI 튜터 응답을 가져오지 못했습니다." }, 502, origin, env);
      }

      const data = await openaiResponse.json();
      const text = extractOutputText(data) || "도움말을 생성하지 못했습니다. 작성 내용을 조금 더 구체적으로 적어 다시 시도해 주세요.";
      return jsonResponse({ tip: text, model: usedModel }, 200, origin, env);
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      return jsonResponse({ error: "AI 튜터 서버에서 오류가 발생했습니다." }, 500, origin, env);
    }
  }
};

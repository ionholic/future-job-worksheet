const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

function corsHeaders(origin, env) {
  const allowedOrigins = String(env.ALLOWED_ORIGIN || "*").split(",").map((value) => value.trim()).filter(Boolean);
  const allowOrigin = allowedOrigins.includes("*") || allowedOrigins.includes(origin)
    ? origin || allowedOrigins[0]
    : allowedOrigins[0];

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

  if (includesAny(text, ["참고한 자료", "출처:", "확인한 내용"])) {
    return "reference";
  }

  if (worksheet === "group" && includesAny(text, ["사라지거나 줄어들", "새롭게 생겨날"])) {
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
    "- 자료 기록형 질문이다. 출처가 구체적인지, 확인한 내용이 출처와 연결되는지 점검한다.",
    "- 빈칸이면 믿을 만한 자료 유형과 기록 예시를 제시한다.",
    "- 확인한 내용은 긴 설명보다 핵심 사실, 통계, 변화 이유처럼 조사에 쓸 수 있는 내용으로 안내한다."
  ].join("\n"),
  groupKeywords: [
    "- 모둠이 낸 여러 키워드를 종합해 보는 질문이다.",
    "- 개별 답을 하나씩 길게 평가하지 말고 공통점, 차이점, 빠진 관점을 묶어서 안내한다.",
    "- 단답형 키워드에 맞게 직업명이나 변화 이유를 짧고 분명하게 보완하도록 돕는다."
  ].join("\n"),
  groupCandidates: [
    "- 조사하고 싶은 직업군을 고르는 질문이다.",
    "- 직업군과 선택 이유가 서로 맞는지, 탐구할 가치가 있는지, 너무 넓거나 좁지 않은지 점검한다.",
    "- 추천 답변은 직업군/일과 이유가 함께 보이도록 짧은 예시로 제시한다."
  ].join("\n"),
  careerPrep: [
    "- 진로 준비 계획을 쓰는 질문이다.",
    "- 길러야 할 역량, 자격증/교육, 경험 쌓기처럼 학생이 실천할 수 있는 준비를 중심으로 안내한다.",
    "- 추상적인 다짐보다 구체적인 활동, 배울 내용, 경험 방법이 들어가도록 돕는다."
  ].join("\n"),
  shortAnswer: [
    "- 단답 또는 짧은 구문으로 답하는 질문이다.",
    "- 학생 답이 적절하면 왜 맞는지 짧게 설명하고, 보충 키워드나 유사 예시를 덧붙인다.",
    "- 추천 답변은 한두 문장 이하로 간결하게 제시한다."
  ].join("\n"),
  essay: [
    "- 서술형 질문이다.",
    "- 주장만 쓰지 않도록 이유, 근거, 예시, 비교, 나의 생각 중 필요한 요소를 보완하게 한다.",
    "- 추천 답변은 학생이 자기 말로 바꿔 쓸 수 있는 참고용 문장으로 제시한다."
  ].join("\n")
};

function buildPrompt({ worksheet, section, question, answer }) {
  const worksheetName = worksheet === "group" ? "모둠 활동지" : "개인 활동지";
  const answerState = answer ? "작성됨" : "작성 전";
  const questionType = classifyQuestion({ worksheet, section, question, answer });
  const typeGuide = QUESTION_TYPE_GUIDES[questionType] || QUESTION_TYPE_GUIDES.essay;

  return [
    `너는 중고등학생의 미래직업탐구 보고서 작성을 돕는 AI 튜터다.`,
    `대상 활동지: ${worksheetName}`,
    `활동 영역: ${section || "미지정"}`,
    `질문: ${question || "미지정"}`,
    `학생 답변 상태: ${answerState}`,
    `학생이 작성한 내용: ${answer || "(아직 작성하지 않음)"}`,
    "",
    "핵심 원칙:",
    "- 학생 답을 대신 완성하는 것이 아니라, 질문에 알맞은 답변을 할 수 있도록 돕는다.",
    "- 작성 전이거나 막힌 경우에도 추천 답변 예시를 제공한다.",
    "- 추천 답변은 참고용 예시이며 그대로 베껴 쓰기보다 자기 말로 바꾸도록 안내한다.",
    "- 단답형 질문은 짧은 키워드, 직업명, 핵심 이유 중심으로 조언한다.",
    "- 서술형 질문은 근거, 구체성, 예시, 비교, 나의 생각 중 필요한 요소를 보완하도록 돕는다.",
    "- 학생 답이 적절하면 적절한 이유를 설명하고, 보충 설명이나 더 좋은 표현을 제안한다.",
    "- 학교명, 이름 등 개인정보를 요구하지 않는다.",
    "- 사실 확인이 필요한 내용은 자료를 다시 확인하라고 안내한다.",
    "- 한국어로 짧고 구체적으로 답한다. 전체 답변은 8문장 이내로 제한한다.",
    "",
    "질문 유형별 지침:",
    typeGuide,
    "",
    "출력 형식:",
    "아래 Markdown 형식을 정확히 지킨다.",
    "### 답변 점검",
    "- 작성 전이면 어떤 방향으로 쓰면 되는지 말한다.",
    "- 작성됨이면 질문에 맞는 부분과 적절성을 점검한다.",
    "",
    "### 보완 힌트",
    "- 더 구체화할 점이나 확인할 점을 1~2개 제시한다.",
    "",
    "### 추천 답변",
    "- 예: 질문 유형에 맞는 참고용 답변을 1~2개 제시한다.",
    "- 학생 답이 있으면 그 답을 바탕으로 더 나은 형태의 예시를 제시한다."
  ].join("\n");
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("JSON 요청만 지원합니다.");
  }

  const body = await request.json();
  return {
    worksheet: sanitizeText(body.worksheet, 20),
    section: sanitizeText(body.section, 80),
    question: sanitizeText(body.question, 160),
    answer: sanitizeText(body.answer, 2000)
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";

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
      return jsonResponse({ error: error.message }, 400, origin, env);
    }

    const prompt = buildPrompt(payload);

    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: env.MODEL || "gpt-5.4-mini",
          input: prompt,
          max_output_tokens: 650
        })
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(JSON.stringify({ status: openaiResponse.status, error: errorText.slice(0, 500) }));
        return jsonResponse({ error: "AI 튜터 응답을 가져오지 못했습니다." }, 502, origin, env);
      }

      const data = await openaiResponse.json();
      const text = extractOutputText(data) || "도움말을 생성하지 못했습니다. 작성 내용을 조금 더 구체적으로 적어 다시 시도해 주세요.";
      return jsonResponse({ tip: text }, 200, origin, env);
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      return jsonResponse({ error: "AI 튜터 서버에서 오류가 발생했습니다." }, 500, origin, env);
    }
  }
};

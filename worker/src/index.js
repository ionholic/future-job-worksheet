const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

function corsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const allowOrigin = allowedOrigin === "*" || origin === allowedOrigin ? origin || allowedOrigin : allowedOrigin;

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

function buildPrompt({ worksheet, section, question, answer }) {
  const worksheetName = worksheet === "group" ? "모둠 활동지" : "개인 활동지";
  return [
    `너는 중고등학생의 미래직업탐구 보고서 작성을 돕는 AI 튜터다.`,
    `대상 활동지: ${worksheetName}`,
    `활동 영역: ${section || "미지정"}`,
    `질문: ${question || "미지정"}`,
    `학생이 작성한 내용: ${answer || "(아직 작성하지 않음)"}`,
    "",
    "원칙:",
    "- 정답을 대신 완성하지 말고, 학생이 직접 고칠 수 있는 힌트를 준다.",
    "- 학교명, 이름 등 개인정보를 요구하지 않는다.",
    "- 근거가 필요한 내용은 자료를 다시 확인하라고 안내한다.",
    "- 한국어로 짧고 구체적으로 답한다.",
    "",
    "출력 형식:",
    "1. 지금 잘한 점 1개",
    "2. 보완하면 좋은 점 2개",
    "3. 바로 써볼 수 있는 질문 2개"
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
          max_output_tokens: 420
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

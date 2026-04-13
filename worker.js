const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function createJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return createJsonResponse(
        { error: { message: "Method not allowed" } },
        405,
      );
    }

    if (!env.OPENAI_API_KEY) {
      return createJsonResponse(
        { error: { message: "Missing OPENAI_API_KEY worker secret." } },
        500,
      );
    }

    let requestBody;

    try {
      requestBody = await request.json();
    } catch (error) {
      return createJsonResponse(
        { error: { message: "Invalid JSON body." } },
        400,
      );
    }

    if (!Array.isArray(requestBody.messages)) {
      return createJsonResponse(
        {
          error: { message: "The request body must include a messages array." },
        },
        400,
      );
    }

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: requestBody.model || env.OPENAI_MODEL || "gpt-4o",
          messages: requestBody.messages,
          temperature: requestBody.temperature ?? 0.7,
          max_tokens: requestBody.max_tokens ?? 500,
        }),
      },
    );

    const data = await openaiResponse.json();

    return createJsonResponse(data, openaiResponse.status);
  },
};

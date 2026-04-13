// Copy this code into your Cloudflare Worker script

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: { message: "Method not allowed" } }),
        {
          status: 405,
          headers: corsHeaders,
        },
      );
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: "Missing OPENAI_API_KEY secret" } }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    let userInput;

    try {
      userInput = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: { message: "Invalid JSON body" } }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (!userInput.messages || !Array.isArray(userInput.messages)) {
      return new Response(
        JSON.stringify({
          error: { message: "Request body must include a messages array" },
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const requestBody = {
      model: "gpt-4o",
      messages: userInput.messages,
      max_tokens: 300,
    };

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: corsHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: { message: "Failed to contact OpenAI" } }),
        {
          status: 502,
          headers: corsHeaders,
        },
      );
    }
  },
};

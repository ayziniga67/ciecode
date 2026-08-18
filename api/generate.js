export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, mimeType } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is missing in Vercel settings.' });
    }

    if (!image) {
      return res.status(400).json({ error: 'No image uploaded.' });
    }

    const SYSTEM_PROMPT = `
You are a CIE Computer Science pseudocode translator.
Generate ONLY valid CIE pseudocode for testing algorithms in a compiler.

STRICT RULES:
1. OUTPUT ONLY CIE PSEUDOCODE. DO NOT output internal thoughts, <think> tags, explanations, or prose.
2. Use strict CIE syntax:
   - 1-based array indexing (e.g. DECLARE List : ARRAY[1:5] OF STRING)
   - Proper types (INTEGER, REAL, STRING, CHAR, BOOLEAN)
   - Left assignment arrow (<-)
3. Detect algorithm intent and pre-populate arrays with realistic test values (embed search targets or min/max values directly).
4. Do NOT add conversational comments. End strictly with:
// --- WRITE YOUR SOLUTION BELOW ---
`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      return res.status(groqResponse.status).json({ 
        error: data.error?.message || 'Groq API request failed.' 
      });
    }

    let code = data.choices?.[0]?.message?.content || '';

    // Strip internal <think>...</think> tags emitted by reasoning models
    code = code.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip markdown code block ticks
    code = code.replace(/```(pseudocode|text)?\n?/ig, '').replace(/```/g, '').trim();

    return res.status(200).json({ code });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

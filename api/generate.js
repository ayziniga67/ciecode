export default async function handler(req, res) {
  // Ensure POST request
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
You are an expert CIE Computer Science pseudocode translator. Analyze the uploaded exam question and generate setup pseudocode.

CRITICAL RULES:
1. Strict CIE Syntax: Use 1-based indexing (ARRAY[1:N] OF INTEGER), correct types, standard assignment (<-).
2. Intent & Target Detection:
   - IF SEARCHING: Include the target search item in the pre-populated array data at least once so a search algorithm succeeds.
   - IF MAX/MIN: Include clear extreme numbers.
   - IF SORTING: Supply unsorted test data.
3. Structure:
   - Include a top comment describing the parsed goal.
   - Declare all variables and arrays first.
   - Populate test values sequentially.
   - End strictly with: "// --- WRITE YOUR SOLUTION BELOW ---"
4. Output: Return ONLY raw pseudocode. Do not wrap in markdown code ticks or conversational text.
`;

    // Send image to Groq's Vision Model
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
        ]
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      return res.status(groqResponse.status).json({ 
        error: data.error?.message || 'Groq API request failed.' 
      });
    }

    let code = data.choices?.[0]?.message?.content || '';
    code = code.replace(/```(pseudocode|text)?\n?/ig, '').replace(/```/g, '').trim();

    return res.status(200).json({ code });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

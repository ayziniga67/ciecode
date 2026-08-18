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
You are an expert CIE Computer Science (Paper 2 / 9618) Pseudocode Data Generator. 
Analyze the uploaded exam question and generate ONLY the setup pseudocode (variable declarations and mock test data).

STRICT OUTPUT RULES:
1. NEVER SOLVE THE ALGORITHM. Only provide the setup data required for testing.
2. NO CONVERSATIONAL TEXT.
3. SEPERATE THE CODE FROM YOUR THOUGHTS.
4. ANY THINKING TO BE DONE SHOULD HAVE '//' BEFORE IT OR BEFORE THE FOLLOWING LINE STARTS.
5. ENDING: Always end the output strictly with: // --- WRITE YOUR SOLUTION BELOW ---
6. AFTER COMPLETING COMPILE THE CODE AT THE END

CIE SYNTAX RULES (PAPERSDOCK COMPILER STRICT):
- Keywords: Must be UPPERCASE (DECLARE, TYPE, ENDTYPE, ARRAY, OF, INTEGER, REAL, STRING, BOOLEAN, CHAR, DATE).
- Assignment: Must use the left arrow (<-). Never use = or :=.
- Variables: DECLARE VariableName : DATA_TYPE
- 1D Arrays: DECLARE ListName : ARRAY[1:10] OF INTEGER (Always 1-based indexing).
- 2D Arrays: DECLARE GridName : ARRAY[1:10, 1:10] OF STRING
- Records: 
  TYPE Student
      DECLARE Name : STRING
  ENDTYPE
  DECLARE Class : ARRAY[1:30] OF Student
  Class[1].Name <- "Alice"
`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reasoning_effort: 'none',
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

    // --- PROGRAMMATIC REMOVAL OF THOUGHTS ---
    // This function completely deletes the <think>...</think> block and everything inside it
    code = code.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Strip markdown code block ticks
    code = code.replace(/```(pseudocode|text)?\n?/ig, '');
    code = code.replace(/```/g, '');
    code = code.trim();

    // Failsafe: Ensure it ends with the required separator
    if (!code.includes('// --- WRITE YOUR SOLUTION BELOW ---')) {
        code += '\n\n// --- WRITE YOUR SOLUTION BELOW ---';
    }

    return res.status(200).json({ code });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

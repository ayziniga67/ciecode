export async function POST(request) {
    try {
        const body = await request.json();
        const apiKey = process.env.GEMINI_API_KEY; // Pulled secretly from Vercel

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server API Key is missing." }), { 
                status: 500, headers: { 'Content-Type': 'application/json' } 
            });
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: SYSTEM_PROMPT },
                        { inline_data: { mime_type: body.mimeType, data: body.image } }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            return new Response(JSON.stringify({ error: data.error.message }), { 
                status: 400, headers: { 'Content-Type': 'application/json' } 
            });
        }

        let generatedText = data.candidates[0].content.parts[0].text;
        generatedText = generatedText.replace(/```(pseudocode|text)?\n?/ig, '').replace(/```/g, '').trim();

        return new Response(JSON.stringify({ code: generatedText }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' } 
        });
    }
}

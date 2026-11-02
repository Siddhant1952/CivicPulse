// Define the strict extraction instructions
const systemInstruction = `You are an automated data extraction engine for a civic grievance triage system. Analyze the user's input (image description, audio transcript, or text) and extract critical incident details. Evaluate the severity and route the issue to the relevant local authority. You must strictly output valid JSON matching the provided schema. If a specific detail is missing from the input, return null.`;

// Define the exact JSON structure your database expects
const grievanceSchema = {
  type: "object",
  properties: {
    primary_issue: {
      type: "string",
      description: "Categorize the problem (e.g., Road Damage, Pollution, Water Leak, Waste, Streetlights)."
    },
    location: {
      type: "string",
      description: "Any mentioned street names, landmarks, pin codes, or neighborhood details."
    },
    severity: {
      type: "string",
      enum: ["High", "Medium", "Low"],
      description: "High (immediate safety risk/major failure), Medium (nuisance/moderate damage), Low (minor)."
    },
    routing_authority: {
      type: "string",
      description: "The municipal department that should fix this (e.g., PWD, Water Board, Electricity Board)."
    },
    description: {
      type: "string",
      description: "A clean, 1-2 sentence summary of the exact problem."
    },
    evidence_type: {
      type: "string",
      enum: ["Image", "Audio", "Text"],
      description: "The format the user submitted."
    },
    critical_entities: {
      type: "array",
      items: { type: "string" },
      description: "Specific details like vehicle license plates, shop names, or exact timestamps mentioned."
    }
  },
  required: ["primary_issue", "location", "severity", "routing_authority", "description", "evidence_type", "critical_entities"]
};

// Example function to call your LLM (using OpenAI SDK format as an example)
async function extractGrievanceData(userContent) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // or "gemini-1.5-pro" if using Google's SDK
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userContent } // This can be a text prompt or an image URL array
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "grievance_extraction",
        schema: grievanceSchema,
        strict: true
      }
    },
    temperature: 0.1 // Keep temperature low for deterministic data extraction
  });

  // The output is guaranteed to be a clean JSON object ready for your MongoDB/PostgreSQL database
  return JSON.parse(response.choices[0].message.content);
}
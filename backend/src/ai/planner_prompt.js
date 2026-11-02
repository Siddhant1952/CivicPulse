// Define the exact JSON structure for the municipal action plan
const plannerSchema = {
  type: "object",
  properties: {
    priority_level: {
      type: "string",
      enum: ["Critical", "Standard", "Low"],
      description: "Critical for high-severity safety risks, Standard for moderate issues, Low for minor nuisances."
    },
    assigned_team: {
      type: "string",
      description: "The specific rapid response team or contractor unit assigned to the task (e.g., 'Ward 4 PWD Civil Unit', 'Emergency Electrical Squad')."
    },
    required_equipment: {
      type: "array",
      items: { type: "string" },
      description: "List of tools, vehicles, or materials needed to fix the issue (e.g., 'JCB Excavator', 'Asphalt mix', 'Safety barricades')."
    },
    step_by_step_plan: {
      type: "array",
      items: { type: "string" },
      description: "A chronological 3-4 step action plan for the municipal team to resolve the issue safely and efficiently."
    },
    estimated_sla: {
      type: "string",
      description: "Estimated time to resolve based on priority (e.g., '24 hours', '3-5 business days')."
    },
    public_status_update: {
      type: "string",
      description: "A polite, concise 1-sentence update to display on the citizen dashboard explaining that action is being taken."
    }
  },
  required: ["priority_level", "assigned_team", "required_equipment", "step_by_step_plan", "estimated_sla", "public_status_update"]
};

const plannerSystemInstruction = `You are an expert municipal dispatcher and city operations planner. 
Your job is to read a structured JSON report of a civic issue and generate a practical, safe, and efficient action plan for the municipal workforce. 
Allocate standard government resources logically based on the routing_authority and severity. Keep plans realistic and localized to standard Indian municipal procedures.`;

// Function to call the LLM to generate the plan
async function generateActionPlan(extractedGrievanceData) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // or "gemini-1.5-pro"
    messages: [
      { role: "system", content: plannerSystemInstruction },
      { role: "user", content: JSON.stringify(extractedGrievanceData) } 
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "municipal_action_plan",
        schema: plannerSchema,
        strict: true
      }
    },
    temperature: 0.2 // Slight creativity for practical step generation, but mostly deterministic
  });

  return JSON.parse(response.choices[0].message.content);
}

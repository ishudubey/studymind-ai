/**
 * StudyMind AI - Gemini API Client Service
 * Powered by gemini-2.5-flash-lite via direct REST fetch requests.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * Executes a raw request to the Gemini API.
 * Handles rate limits, invalid keys, and network issues.
 */
async function callGeminiAPI(prompt, apiKey) {
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const url = `${GEMINI_API_URL}?key=${apiKey}`;
  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    if (response.status === 400 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }

    if (!response.ok) {
      throw new Error(`API_ERROR_STATUS_${response.status}`);
    }

    const data = await response.json();
    
    // Safely extract candidate text
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('INVALID_API_RESPONSE');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    // Propagate friendly error messages
    if (error.message === 'RATE_LIMIT_EXCEEDED') {
      throw new Error("You've used today's free quota. Resets at midnight!");
    } else if (error.message === 'INVALID_API_KEY') {
      throw new Error("Invalid Gemini API Key. Please check and re-enter your key in Settings.");
    } else if (error.message === 'API_KEY_MISSING') {
      throw new Error("Gemini API Key is missing. Please add your key in the Settings page.");
    } else {
      throw new Error("Unable to contact Gemini AI. Please check your internet connection or try again later.");
    }
  }
}

/**
 * Utility to parse JSON safely from LLM outputs that might include markdown code fences.
 */
function cleanAndParseJSON(rawText) {
  let cleaned = rawText.trim();
  
  // Strip markdown code fences (e.g. ```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift(); // Remove starting ```
    }
    if (lines[lines.length - 1] === '```') {
      lines.pop(); // Remove ending ```
    }
    cleaned = lines.join('\n').trim();
  }
  
  // Find first [ or { and last ] or } to isolate JSON payload
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  
  let jsonStart = -1;
  let jsonEnd = -1;
  
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    jsonStart = firstBracket;
    jsonEnd = cleaned.lastIndexOf(']');
  } else if (firstBrace !== -1) {
    jsonStart = firstBrace;
    jsonEnd = cleaned.lastIndexOf('}');
  }
  
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * AI FEATURE: Chat Concierge
 */
async function getConciergeResponse(userMessage, taskList, moods, chatHistory, apiKey) {
  const tasksSummary = taskList.length > 0 
    ? taskList.map(t => `- Subject: ${t.subject}, Topic: ${t.topic}, Deadline: ${t.deadline}, Priority: ${t.priority}, Status: ${t.completed ? 'Completed' : 'Pending'}`).join('\n')
    : 'No tasks currently scheduled.';
    
  const moodsSummary = moods.length > 0
    ? moods.slice(-5).map(m => `Energy level: ${m.energy}/5 on ${m.date}`).join(', ')
    : 'No focus sessions or energy check-ins logged yet.';

  const systemPrompt = `You are a helpful, premium personal study concierge.
Your primary directive is to provide short, encouraging, highly actionable advice.
The student's pending and completed tasks are:
${tasksSummary}

The student's recent energy level logs (on a 1-5 emoji scale) are:
${moodsSummary}

When the student asks a question, keep your answer brief (under 4-5 sentences), friendly, and structured. Adapt your suggestions based on their current energy mood check-ins (e.g. if they logged low energy (1-2), suggest shorter, easier tasks, or breaks. If they are energized (4-5), encourage them to tackle high-priority subjects).

Student's message: "${userMessage}"`;

  return await callGeminiAPI(systemPrompt, apiKey);
}

/**
 * AI FEATURE: Topic Explainer (Exactly 5 line simple explanation)
 */
async function getTopicExplanation(topicName, apiKey) {
  const prompt = `You are an expert tutor.
Explain the topic "${topicName}" in a simple, easy-to-understand way for a student who is currently stuck.
Provide EXACTLY 5 sentences or bullet points. Make it clear and structured. Do not use complex jargon. No markdown headers.`;

  return await callGeminiAPI(prompt, apiKey);
}

/**
 * AI FEATURE: Quiz Generator (5 MCQs with choices and correct answers)
 */
async function generateStudyQuiz(topicOrNotes, apiKey) {
  const prompt = `You are a testing coordinator.
Generate exactly 5 multiple choice questions (MCQs) based on this topic or notes text:
"${topicOrNotes}"

Each question must have exactly 4 choices.
You MUST output ONLY a valid raw JSON array of objects, with NO markdown code block wrappers or other introductory/concluding text.
Each object in the array must have the exact following keys:
- "question": (string) the question text
- "options": (array of exactly 4 strings) the answer choices
- "answerIndex": (number, 0 to 3) the 0-indexed position of the correct choice in the "options" array

Example JSON output format:
[
  {
    "question": "What is the formula of water?",
    "options": ["CO2", "H2O", "O2", "NaCl"],
    "answerIndex": 1
  }
]`;

  const rawResult = await callGeminiAPI(prompt, apiKey);
  try {
    return cleanAndParseJSON(rawResult);
  } catch (err) {
    console.error("Failed to parse Quiz JSON from Gemini:", rawResult);
    throw new Error("The study concierge returned an invalid quiz format. Please try again.");
  }
}

/**
 * AI FEATURE: Syllabus Planner
 */
async function parseSyllabusToTasks(syllabusText, apiKey) {
  const prompt = `You are an academic advisor.
Parse the following exam syllabus or course outline:
"${syllabusText}"

Break it down into individual study topics/tasks.
You MUST output ONLY a valid raw JSON array of objects, with NO markdown code block wrappers or other text.
Each object in the array must have the exact following keys:
- "subject": (string) name of the subject (e.g. Chemistry, Calculus)
- "topic": (string) specific subtopic (e.g. Acid-Base Equilibrium, Integration by Parts)
- "priority": (string, must be either "high", "medium", or "low") based on weight mentioned or complexity
- "deadlineDays": (number) suggested deadline in number of days from today (e.g. 3, 5, 7, 10, 14) to spread out the schedule reasonably

Example JSON output format:
[
  {
    "subject": "Physics",
    "topic": "Newtonian Gravity",
    "priority": "high",
    "deadlineDays": 4
  }
]`;

  const rawResult = await callGeminiAPI(prompt, apiKey);
  try {
    return cleanAndParseJSON(rawResult);
  } catch (err) {
    console.error("Failed to parse Syllabus JSON from Gemini:", rawResult);
    throw new Error("The study concierge failed to parse the syllabus format. Please try again.");
  }
}

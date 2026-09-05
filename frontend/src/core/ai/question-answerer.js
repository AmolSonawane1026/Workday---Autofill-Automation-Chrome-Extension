import { generateWithGemini } from './gemini-client.js';

export async function answerApplicationQuestions(questions, resumeData, options = {}) {
  if (!questions?.length || !resumeData) return [];

  const prompt = `You are helping a job applicant fill in Workday application screening questions.
Answer each question from the applicant's perspective using the applicant's resume information.

Applicant Information:
${JSON.stringify(resumeData, null, 2)}

Questions:
${JSON.stringify(questions.map(q => ({
  id: q.id,
  label: q.label || q.question,
  type: q.type,
  options: q.options || []
})), null, 2)}

Formatting & Logic Rules:
1. If the question asks for a number, a count, or years of experience, answer with just the clean number (e.g., "3").
2. If it is a Yes/No question:
   - For work authorization/legal right to work: reply "Yes".
   - For visa sponsorship required: reply "No" unless candidate profile states sponsorship needed.
   - For previous employment / previous team member: reply "No" unless candidate worked at this specific employer.
   - For 18+ years old: reply "Yes".
3. If it is a dropdown/choice question: pick the best matching option from the provided options list.
4. For voluntary self-identification (race, gender, veteran, disability): choose "I Choose Not to Disclose" or "Decline to Self-Identify" from the options.
5. For open text / essay questions: answer concisely in first person (1-2 professional sentences, max 350 chars).

Return strictly JSON:
{
  "answers": [
    {
      "id": "question id",
      "question": "question text",
      "answer": "answer text",
      "confidence": 0.95,
      "reasoning": "rationale"
    }
  ]
}`;

  try {
    const rawResponse = await generateWithGemini(prompt, { ...options, jsonOutput: true });
    const parsed = JSON.parse(rawResponse);
    return parsed.answers || [];
  } catch (error) {
    console.error('Gemini question answering error:', error);
    return questions.map(q => ({
      id: q.id,
      question: q.label || q.question,
      answer: q.type === 'radio' ? 'No' : '',
      confidence: 0.3,
      reasoning: 'Review required'
    }));
  }
}

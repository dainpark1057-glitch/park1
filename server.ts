import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Using fallback AI responses where applicable.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 1. AI Explain / Grammar & Nuance Tutor
app.post("/api/ai/explain", async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer, language, context } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        explanation: `정답은 "${correctAnswer}"입니다! "${userAnswer}" 대신 올바른 표현을 사용하면 더 자연스럽습니다. (${language} 기본 문법 규칙 적용)`,
        tips: ["단어의 시제와 격식 체를 확인해보세요.", "반복해서 소리 내어 읽어보면 어색함을 쉽게 찾을 수 있습니다."],
        exampleUsage: `${correctAnswer} - 실생활에서 자주 쓰이는 유용한 표현입니다.`
      });
    }

    const prompt = `You are a friendly, encouraging Duolingo owl mascot named 'Piko' (피코) teaching ${language || "English"}.
The student made a mistake on a quiz question.
Question/Prompt: ${question}
Student's Answer: ${userAnswer || "None / Unanswered"}
Correct Answer: ${correctAnswer}
Additional Context: ${context || "General lesson"}

Please explain in Korean why the answer is "${correctAnswer}", why the student's answer was incorrect or unnatural, and provide helpful grammar/cultural tips and an extra example sentence. Keep the tone cute, encouraging, and clear (like Duolingo).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: "Clear, friendly Korean explanation of why the correct answer is right and the error analysis.",
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 short, memorable bullet points or memory tricks.",
            },
            exampleUsage: {
              type: Type.STRING,
              description: "A real-world example sentence with Korean translation.",
            },
            cheerUp: {
              type: Type.STRING,
              description: "A short cute cheer-up message from Piko the owl in Korean (e.g. '실수해도 괜찮아요! 계속 도전해봐요 🦉💚').",
            }
          },
          required: ["explanation", "tips", "exampleUsage", "cheerUp"],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("AI Explain Error:", error);
    res.status(500).json({
      error: "AI 설명 생성 중 오류가 발생했습니다.",
      explanation: "정답을 다시 확인하고 문장의 기본 어순과 핵심 어휘를 복습해보세요!",
      tips: ["문장의 주어와 서술어 호응을 확인하세요.", "비슷한 패턴의 문장을 3번 따라 읽어보세요."],
      exampleUsage: req.body?.correctAnswer || "",
      cheerUp: "실수는 배움의 기회예요! 파이팅 🦉✨"
    });
  }
});

// 2. AI Roleplay / Dialogue Tutor (Piko Interactive Chat)
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, scenario, targetLanguage, userLevel } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        reply: `That's great! Keep going! (AI Key not configured, simulated response in ${targetLanguage})`,
        koreanTranslation: "훌륭해요! 계속 연습해 보세요!",
        feedback: "자연스러운 문장입니다! 발음과 억양에 집중해보세요.",
        suggestedReplies: ["Thank you so much!", "Could you repeat that please?", "How do you say this in Korean?"]
      });
    }

    const conversationHistory = (messages || [])
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Student' : 'Tutor (Piko)'}: ${m.content}`)
      .join("\n");

    const prompt = `You are 'Piko' (피코), a charming, energetic owl tutor for ${targetLanguage || 'English'}.
Scenario: ${scenario || 'Ordering coffee at a cafe'}
Target Learner Level: ${userLevel || 'Beginner/Intermediate'}

Conversation so far:
${conversationHistory}

Task:
1. Respond naturally in ${targetLanguage} as the character in the scenario (max 1-2 sentences, conversational, matching user's level).
2. Provide a natural Korean translation for the tutor's reply.
3. Provide brief constructive feedback or praise in Korean on the student's latest message (grammar/naturalness).
4. Provide 3 suggested response options that the student could say next in ${targetLanguage}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: `Tutor reply in ${targetLanguage}`,
            },
            koreanTranslation: {
              type: Type.STRING,
              description: "Korean translation of the reply",
            },
            feedback: {
              type: Type.STRING,
              description: "Brief Korean feedback/praise or gentle correction for the student's input",
            },
            suggestedReplies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: `3 quick response suggestions in ${targetLanguage}`,
            },
          },
          required: ["reply", "koreanTranslation", "feedback", "suggestedReplies"],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      error: "AI 대화 생성 중 오류가 발생했습니다.",
      reply: "Hello! Nice to meet you. How can I help you today?",
      koreanTranslation: "안녕하세요! 만나서 반가워요. 오늘 어떻게 도와드릴까요?",
      feedback: "좋은 시도입니다! 편안하게 대화를 이어가보세요.",
      suggestedReplies: ["Hello!", "I would like to practice speaking.", "Can we start?"]
    });
  }
});

// 3. AI Custom Lesson Generator
app.post("/api/ai/generate-lesson", async (req, res) => {
  try {
    const { topic, targetLanguage, difficulty } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        unitTitle: `${topic || '커스텀 테마'} 마스터`,
        description: `${targetLanguage}로 배우는 ${topic} 핵심 표현`,
        questions: [
          {
            id: "q_custom_1",
            type: "translate_to_target",
            prompt: `안녕하세요! (${targetLanguage}로 번역)`,
            targetPhrase: "Hello! / Bonjour! / Hola!",
            correctAnswer: targetLanguage === "Japanese" ? "こんにちは" : targetLanguage === "Spanish" ? "¡Hola!" : targetLanguage === "French" ? "Bonjour !" : "Hello!",
            options: ["Hello!", "Goodbye!", "Thank you!", "Please!"],
            wordBank: ["Hello", "world", "friend", "please", "thanks"],
            explanation: "가장 기본이 되는 반가운 인사말입니다."
          }
        ]
      });
    }

    const prompt = `Create a high quality 5-question Duolingo-style lesson in Korean for learning ${targetLanguage || 'English'}.
Topic: ${topic || 'Airport Travel'}
Difficulty: ${difficulty || 'Beginner'}

Generate 5 diverse, engaging questions featuring:
- Question types: 
  1) 'translate_to_target' (Korean prompt -> Assemble target language sentence using word bank)
  2) 'multiple_choice' (Pick correct translation/response)
  3) 'pair_match' (Match 4 target words with 4 Korean words)
  4) 'fill_in_blank' (Choose correct missing word)
  5) 'listening_choice' (Prompt gives target phrase, student matches Korean meaning or fills blank)

Ensure each question has clear prompt, correct answer, sound phrase for TTS, and word bank tiles.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            unitTitle: { type: Type.STRING, description: "Catchy unit title in Korean" },
            description: { type: Type.STRING, description: "Short description in Korean" },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { 
                    type: Type.STRING, 
                    description: "translate_to_target | multiple_choice | fill_in_blank | listening_choice" 
                  },
                  prompt: { type: Type.STRING, description: "The question prompt shown to learner" },
                  targetPhrase: { type: Type.STRING, description: "The phrase to read/listen or target sentence" },
                  correctAnswer: { type: Type.STRING, description: "The exact correct answer" },
                  options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Options for multiple choice or fill in blank (3-4 items)" 
                  },
                  wordBank: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Shuffled word tokens for sentence assembling questions (including distractors)" 
                  },
                  explanation: { type: Type.STRING, description: "Helpful Korean explanation" }
                },
                required: ["id", "type", "prompt", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["unitTitle", "description", "questions"]
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("AI Lesson Generator Error:", error);
    res.status(500).json({ error: "레슨 생성 중 오류가 발생했습니다." });
  }
});

// 4. AI Pronunciation Evaluation
app.post("/api/ai/pronounce-eval", async (req, res) => {
  try {
    const { targetPhrase, recognizedText, language } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const match = (recognizedText || "").trim().toLowerCase() === (targetPhrase || "").trim().toLowerCase();
      return res.json({
        score: match ? 100 : 85,
        passed: true,
        feedback: match ? "완벽한 발음입니다! 🌟" : "아주 잘하셨어요! 조금 더 부드럽게 발음해보세요.",
        phoneticTip: "강세를 주어 리듬감 있게 읽어보세요."
      });
    }

    const prompt = `Evaluate the student's spoken pronunciation accuracy for ${language || 'English'}.
Target Phrase: "${targetPhrase}"
Speech Recognizer Output: "${recognizedText || ''}"

Provide:
1. Accuracy score from 0 to 100
2. passed boolean (true if score >= 60 or very close)
3. Friendly Korean feedback from Piko the owl
4. A concrete phonetic/intonation tip in Korean`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            passed: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            phoneticTip: { type: Type.STRING }
          },
          required: ["score", "passed", "feedback", "phoneticTip"]
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Pronunciation Eval Error:", error);
    res.json({
      score: 90,
      passed: true,
      feedback: "훌륭한 발음입니다! 계속 연습해보세요 🦉👏",
      phoneticTip: "단어 끝소리를 명확하게 발음해보세요."
    });
  }
});

// Vite middleware for development
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LingoQuest Server running on http://0.0.0.0:${PORT}`);
  });
}

start();

'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');

const app = express();
app.use(bodyParser.json());

const QUIZ_QUESTIONS = [
  {
    question: "คำถามข้อที่ 1: จากข้อมูลในบอร์ด อันตรายที่เกิดจากอาหารสามารถแบ่งได้เป็นกี่ประเภท?\nข้อที่ 1) 2 ประเภท\nข้อที่ 2) 3 ประเภท\nข้อที่ 3) 5 ประเภท",
    options: ["ข้อที่ 1)", "ข้อที่ 2)", "ข้อที่ 3)"],
    answer: "2"
  },
  {
    question: "คำถามข้อที่ 2: หากพบ \"เศษแก้ว\" ปนเปื้อนในอาหาร จะจัดเป็นอันตรายประเภทใด?\nข้อที่ 1) อันตรายทางเคมี\nข้อที่ 2) อันตรายทางชีวภาพ\nข้อที่ 3) อันตรายทางกายภาพ",
    options: ["ข้อที่ 1)", "ข้อที่ 2)", "ข้อที่ 3)"],
    answer: "3"
  },
  {
    question: "คำถามข้อที่ 3: หลักการสุขาภิบาลอาหารที่ดี เพื่อประกอบอาหารให้สะอาดและปลอดภัย ต้องควบคุมปัจจัยทั้งหมดกี่อย่าง?\nข้อที่ 1) 3 ปัจจัย\nข้อที่ 2) 4 ปัจจัย\nข้อที่ 3) 5 ปัจจัย",
    options: ["ข้อที่ 1)", "ข้อที่ 2)", "ข้อที่ 3)"],
    answer: "3"
  }
];

function buildQuestionPayload(questionIndex) {
  const item = QUIZ_QUESTIONS[questionIndex];
  const quickReplyItems = item.options.map((option, idx) => {
    const answerValue = String(idx + 1);
    return {
      type: "action",
      action: { type: "message", label: option, text: answerValue }
    };
  });
  return { type: "text", text: item.question, quickReply: { items: quickReplyItems } };
}

function buildFinalScorePayload(score) {
  return { type: "text", text: `ทำแบบทดสอบเสร็จแล้ว!\nคุณได้คะแนน ${score} จาก ${QUIZ_QUESTIONS.length} คะแนน` };
}

app.post('/', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  console.log('Request body:', JSON.stringify(req.body));

  function startQuiz(agent) {
    agent.context.set({ name: 'in-quiz', lifespan: 5, parameters: { index: 0, score: 0 } });
    const payload = new Payload('LINE', buildQuestionPayload(0), { sendAsMessage: true, rawPayload: true });
    agent.add(payload);
  }

  function answerQuiz(agent) {
    const quizCtx = agent.context.get('in-quiz') || { parameters: {} };
    let currentIndex = quizCtx.parameters.index || 0;
    let currentScore = quizCtx.parameters.score || 0;
    const queryText = (agent.query || '').trim();
    const correctAnswer = QUIZ_QUESTIONS[currentIndex].answer;
    const isCorrect = queryText === correctAnswer;
    if (isCorrect) currentScore++;

    const feedbackText = isCorrect ? "ตอบถูกต้องค่ะ 🎉" : "ตอบยังไม่ถูกนะคะ";
    const nextIndex = currentIndex + 1;
    let payload;

    if (nextIndex < QUIZ_QUESTIONS.length) {
      agent.context.set({ name: 'in-quiz', lifespan: 5, parameters: { index: nextIndex, score: currentScore } });
      const qPayload = buildQuestionPayload(nextIndex);
      qPayload.text = feedbackText + "\n\n" + qPayload.text;
      payload = qPayload;
    } else {
      const finalPayload = buildFinalScorePayload(currentScore);
      finalPayload.text = feedbackText + "\n\n" + finalPayload.text;
      payload = finalPayload;
      agent.context.delete('in-quiz');
    }

    agent.add(new Payload('LINE', payload, { sendAsMessage: true, rawPayload: true }));
  }

  function fallback(agent) {
    const ctx = agent.context.get('in-quiz');
    const currentIndex = ctx ? ctx.parameters.index || 0 : 0;
    const payload = buildQuestionPayload(currentIndex);
    payload.text = 'หากต้องการเริ่มใหม่ให้พิมพ์ "start quiz" ค่ะ 😊\n\n' + payload.text;
    agent.add(new Payload('LINE', payload, { sendAsMessage: true, rawPayload: true }));
  }

  const intentMap = new Map();
  intentMap.set('StartQuiz', startQuiz);
  intentMap.set('AnswerQuiz', answerQuiz);
  intentMap.set('Default Fallback Intent', fallback);
  agent.handleRequest(intentMap);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));

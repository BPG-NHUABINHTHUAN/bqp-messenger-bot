const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      const event = entry.messaging[0];
      const senderId = event.sender.id;
      if (event.message && event.message.text) {
        const userMessage = event.message.text;
        try {
          const aiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              contents: [
                {
                  parts: [
                    {
                      text: `Bạn là trợ lý AI của Công ty Cổ phần Nhựa Chất Lượng Cao Bình Thuận (BQP). Hãy trả lời lịch sự, chuyên nghiệp bằng tiếng Việt. Hỗ trợ khách hàng về sản phẩm nhựa chất lượng cao.\n\nKhách hàng hỏi: ${userMessage}`
                    }
                  ]
                }
              ]
            }
          );
          const reply = aiResponse.data.candidates[0].content.parts[0].text;
          await axios.post(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            { recipient: { id: senderId }, message: { text: reply } }
          );
        } catch (err) {
          console.error(err.message);
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));

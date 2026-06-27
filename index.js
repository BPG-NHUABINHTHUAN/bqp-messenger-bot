const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const conversations = {};
const lastSeen = {};
const humanMode = {};
const MAX_HISTORY = 12;
const RESET_GAP_MS = 6 * 60 * 60 * 1000;
const HUMAN_TAKEOVER_MS = 30 * 60 * 1000;

const SYSTEM_PROMPT = `Bạn tên là Thuận, nhân viên tư vấn của Công ty Cổ phần Nhựa Chất Lượng Cao Bình Thuận (BQP) – thành viên Tập đoàn Nhựa Bình Thuận (BPG). Bạn am hiểu về gia công chi tiết nhựa kỹ thuật cao (OEM/ODM).

QUY TẮC NGÔN NGỮ (RẤT QUAN TRỌNG):
- BQP hỗ trợ 6 ngôn ngữ: Tiếng Việt, Tiếng Anh, Tiếng Trung, Tiếng Thái, Tiếng Nhật, Tiếng Hàn.
- Hãy TỰ ĐỘNG NHẬN DIỆN ngôn ngữ khách đang dùng và TRẢ LỜI BẰNG ĐÚNG NGÔN NGỮ ĐÓ một cách tự nhiên, chuẩn xác như người bản xứ.
- Khách viết tiếng nào → trả lời tiếng đó. Nếu khách đổi ngôn ngữ giữa chừng, lập tức chuyển theo ngôn ngữ mới.
- Xưng hô tiếng Việt: xưng "em", gọi "Quý khách / anh / chị". Ngôn ngữ khác: dùng cách xưng hô lịch sự, chuyên nghiệp phù hợp văn hóa nước đó.

CẤU TRÚC HỆ SINH THÁI TẬP ĐOÀN NHỰA BÌNH THUẬN (BPG):
A. SẢN XUẤT:
- Pallet nhựa: pallet 1 mặt, pallet 2 mặt, pallet liền khối, pallet mặt bít/mặt hở, pallet có chân (kê hàng), pallet quay vòng trong kho, pallet tải nặng, pallet phục vụ xuất khẩu.
- Thùng & sóng nhựa công nghiệp: sóng bít, sóng hở, thùng A, thùng B, thùng đặc, thùng có lỗ thoáng, khay đựng linh kiện, sọt/rổ nhựa công nghiệp.
- Thùng rác: thùng rác công cộng, thùng rác phân loại, thùng rác có nắp/đạp chân, thùng rác công nghiệp dung tích lớn, thùng rác đô thị/khu dân cư.
- Nông nghiệp – chăn nuôi: chậu hoa, chậu cây cảnh, chậu ươm, khay ươm cây giống, thiết bị chăn nuôi, lồng gà, máng ăn – máng uống, vỉ trứng, sàn nhựa chăn nuôi.
- (Lưu ý: hãy giới thiệu sản phẩm đa dạng, sinh động; nếu khách hỏi chi tiết hoặc cần báo giá thì điều hướng về Hotline 1800 2228 hoặc Fanpage Tập đoàn.)
B. DỊCH VỤ:
- Gia công chi tiết nhựa chất lượng cao: OEM/ODM, gia công chi tiết nhựa kỹ thuật cao theo yêu cầu cho ô tô – xe máy, điện – điện tử, thiết bị gia dụng, y tế, công nghiệp phụ trợ.
- Khuôn (Mould): thiết kế khuôn, chế tạo khuôn, phát triển và tối ưu giải pháp khuôn mẫu.
- BPG Recycle: tái chế nhựa, giải pháp kinh tế tuần hoàn, vật liệu nhựa tái sinh.
- BPG Retail: logistics, giải pháp kho bãi, cho thuê và quản lý pallet (pallet pooling).

HỘI ĐỒNG QUẢN TRỊ / BAN LÃNH ĐẠO BQP:
- BQP là công ty cổ phần niêm yết, có Hội đồng quản trị và Ban lãnh đạo điều hành chuyên nghiệp.
- Thành viên Hội đồng quản trị (CẦN CẬP NHẬT TÊN/CHỨC VỤ CHÍNH XÁC TRƯỚC KHI DÙNG):
  + Chủ tịch HĐQT: [ĐIỀN TÊN]
  + Thành viên HĐQT: [ĐIỀN TÊN], [ĐIỀN TÊN]
  + Tổng Giám đốc / Người đại diện pháp luật: [ĐIỀN TÊN]
- QUY TẮC khi khách hỏi về HĐQT / ban lãnh đạo: chỉ nêu THÔNG TIN ĐÃ ĐƯỢC XÁC NHẬN ở trên. TUYỆT ĐỐI KHÔNG bịa tên, chức vụ. Nếu chưa có thông tin chính xác, trả lời lịch sự rằng thông tin Hội đồng quản trị được công bố chính thức trên website bqp.com.vn và các báo cáo công bố của doanh nghiệp niêm yết (UPCoM/HNX), và mời khách liên hệ Hotline 1800 2228 để được hỗ trợ thêm.

ĐỊNH VỊ CỐT LÕI CỦA BQP:
BQP chuyên gia công sản xuất chi tiết nhựa kỹ thuật cao theo yêu cầu (OEM/ODM), chuyên sản xuất các mặt hàng công nghiệp Pallet, sóng, sọt, thùng rác, là đối tác sản xuất tin cậy của nhiều doanh nghiệp lớn trong nước, doanh nghiệp FDI và đối tác quốc tế.

DOANH NGHIỆP NIÊM YẾT:
- BQP đã niêm yết trên UPCoM (HNX) mã BQP từ 05/11/2025, vốn điều lệ 150 tỷ đồng, đang chuyển niêm yết lên HOSE.

NĂNG LỰC:
- Máy ép phun 100% mới (Haitian, Borche, Woojin); dây chuyền tự động, kiểm soát kích thước chính xác cao; công suất ~24 triệu sản phẩm/năm.
- Chứng nhận: ISO 9001:2015, IATF 16949:2016, Top VNR500.

QUY TẮC DÙNG TỪ "GIA CÔNG" (RẤT QUAN TRỌNG):
- CHỈ dùng từ "gia công" cho: chi tiết nhựa OEM/ODM, chi tiết nhựa kỹ thuật cao theo yêu cầu.
- TUYỆT ĐỐI KHÔNG dùng từ "gia công" cho: pallet, thùng nhựa, thùng rác, chậu hoa, sản phẩm nông nghiệp, khuôn (mould).

QUY TẮC KHI KHÁCH HỎI VỀ: chậu, khuôn, logistics, tái chế, hoặc hệ sinh thái tổng thể:
- Trả lời theo hướng: BQP là thành viên thuộc Tập đoàn Nhựa Bình Thuận (BPG), hoạt động trong hệ sinh thái sản xuất và dịch vụ nhựa toàn diện, rồi điều hướng khách về Fanpage Tập đoàn: https://www.facebook.com/nhuabinhthuan

LIÊN HỆ:
- Hotline 24/7: 1800 2228 | Email: info@nhuabinhthuan.com.vn | Website: bqp.com.vn
- Nhà máy: Lô CN-03, KCN Đồng Văn IV, Phường Lê Hồ, Tỉnh Ninh Bình

QUY TẮC GIAO TIẾP:
- Dựa vào lịch sử để hiểu ngữ cảnh, không hỏi lại điều khách đã nói.
- Tiếng Việt: lần đầu gọi "Quý khách", sau đó TỰ SUY ĐOÁN gọi "anh"/"chị" dựa vào tên hoặc cách khách xưng. KHÔNG HỎI giới tính.
- Trả lời TỰ NHIÊN, thân thiện, NGẮN GỌN tối đa 2-3 câu.
- Khi nói về đối tác: chỉ nói chung "doanh nghiệp lớn trong nước, FDI và quốc tế". KHÔNG nêu tên cụ thể.
- Hỏi giá/số lượng/đặt hàng: mời liên hệ Hotline 1800 2228 hoặc email info@nhuabinhthuan.com.vn.
- KHÔNG bịa giá. Chưa rõ nhu cầu thì mời khách để lại số điện thoại để nhân viên gọi lại.`;

async function callAI(messages) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': 'Bearer ' + GROQ_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      return r.data.choices[0].message.content;
    } catch (err) {
      const code = err.response ? err.response.status : null;
      if ((code === 429 || code === 503) && i < 2) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      console.error(err.response ? JSON.stringify(err.response.data) : err.message);
      return null;
    }
  }
}

async function askAI(sessionId, userMessage) {
  const now = Date.now();
  const gap = lastSeen[sessionId] ? (now - lastSeen[sessionId]) : Infinity;
  lastSeen[sessionId] = now;

  if (gap > RESET_GAP_MS) conversations[sessionId] = [];
  if (!conversations[sessionId]) conversations[sessionId] = [];
  const history = conversations[sessionId];

  const isNewSession = history.length === 0;
  const greetingNote = isNewSession
    ? ' [Tin nhắn MỞ ĐẦU phiên mới. Hãy chào tự nhiên đúng ngôn ngữ khách rồi trả lời.]'
    : ' [Cuộc trò chuyện đang TIẾP DIỄN. KHÔNG chào lại, trả lời thẳng nội dung.]';

  history.push({ role: 'user', content: userMessage });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + greetingNote },
    ...history
  ];

  const reply = await callAI(messages);
  const finalReply = reply || 'Dạ em xin lỗi, hệ thống đang bận. Quý khách vui lòng thử lại sau ít phút hoặc gọi Hotline 1800 2228 ạ.';
  if (reply) history.push({ role: 'assistant', content: reply });
  return finalReply;
}

async function sendText(senderId, text) {
  try {
    await axios.post(
      'https://graph.facebook.com/v18.0/me/messages?access_token=' + PAGE_ACCESS_TOKEN,
      { recipient: { id: senderId }, message: { text: text } }
    );
  } catch (err) {
    console.error(err.response ? JSON.stringify(err.response.data) : err.message);
  }
}

app.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) return res.status(400).json({ reply: 'Thiếu thông tin.' });
    const reply = await askAI('web_' + sessionId, message);
    res.json({ reply: reply });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ reply: 'Dạ hệ thống đang bận, Quý khách vui lòng thử lại sau ạ.' });
  }
});

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
      if (!event) continue;

      if (event.message && event.message.is_echo) {
        const customerId = event.recipient.id;
        if (!event.message.app_id) humanMode['fb_' + customerId] = Date.now();
        continue;
      }

      const senderId = event.sender.id;
      if (!senderId) continue;
      const sid = 'fb_' + senderId;

      if (humanMode[sid] && (Date.now() - humanMode[sid] < HUMAN_TAKEOVER_MS)) continue;

      if (event.message) {
        const text = event.message.text;
        const hasAttachment = event.message.attachments && event.message.attachments.length > 0;

        if (text && /gặp (nhân viên|người|tư vấn viên thật)|người thật|talk to (a |an )?(human|agent|staff|person)|real person|真人|人工|客服|พนักงาน|担当者|상담원/i.test(text)) {
          humanMode[sid] = Date.now();
          await sendText(senderId, 'Dạ vâng, em sẽ chuyển tới nhân viên tư vấn BQP, anh/chị vui lòng chờ hoặc gọi Hotline 1800 2228 ạ.');
          continue;
        }

        if (hasAttachment) {
          if (text && text.trim().length > 0) {
            await sendText(senderId, await askAI(sid, text + ' (khách gửi kèm hình ảnh)'));
          } else {
            await sendText(senderId, 'Dạ em đã nhận hình ảnh của Quý khách. Quý khách vui lòng cho em biết cần tư vấn gì về hình này ạ? Hoặc em xin chuyển nhân viên hỗ trợ ạ.');
          }
          continue;
        }

        if (text) await sendText(senderId, await askAI(sid, text));
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Bot running on port ' + PORT); });

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const conversations = {};
const lastSeen = {};
const humanMode = {}; // senderId -> thời điểm chuyển sang người thật
const MAX_HISTORY = 12;
const RESET_GAP_MS = 6 * 60 * 60 * 1000;       // 6 tiếng: phiên mới, được chào lại
const HUMAN_TAKEOVER_MS = 30 * 60 * 1000;      // 30 phút: bot nhường người thật

const SYSTEM_PROMPT = `Bạn tên là Thuận, là nhân viên tư vấn (xưng "em") của Công ty Cổ phần Nhựa Chất Lượng Cao Bình Thuận (BQP) – thành viên Tập đoàn Nhựa Bình Thuận (BPG). Bạn am hiểu về gia công chi tiết nhựa kỹ thuật cao (OEM/ODM).

CẤU TRÚC HỆ SINH THÁI TẬP ĐOÀN NHỰA BÌNH THUẬN (BPG):
A. SẢN XUẤT:
- Công nghiệp: pallet nhựa; thùng nhựa công nghiệp (sóng bít, sóng hở, thùng A, thùng B); thùng rác.
- Nông nghiệp: chậu hoa, chậu cây, chậu ươm, thiết bị chăn nuôi, lồng gà, vỉ trứng, sàn nhựa.
B. DỊCH VỤ:
- Gia công chi tiết nhựa chất lượng cao: OEM/ODM, gia công chi tiết nhựa kỹ thuật cao theo yêu cầu.
- Khuôn (Mould): thiết kế khuôn, chế tạo khuôn, phát triển giải pháp khuôn mẫu.
- BPG Recycle: tái chế nhựa, giải pháp kinh tế tuần hoàn.
- BPG Retail: logistics, giải pháp kho bãi, cho thuê và quản lý pallet.

ĐỊNH VỊ CỐT LÕI CỦA BQP:
BQP chuyên gia công sản xuất chi tiết nhựa kỹ thuật cao theo yêu cầu (OEM/ODM), là đối tác sản xuất tin cậy của nhiều doanh nghiệp lớn trong nước, doanh nghiệp FDI và đối tác quốc tế.

DOANH NGHIỆP NIÊM YẾT:
- BQP đã niêm yết trên UPCoM (HNX) mã BQP từ 05/11/2025, vốn điều lệ 150 tỷ đồng, đang chuyển niêm yết lên HOSE.

NĂNG LỰC:
- Máy ép phun 100% mới (Haitian, Borche, Woojin); dây chuyền tự động, kiểm soát kích thước chính xác cao; công suất ~24 triệu sản phẩm/năm.
- Chứng nhận: ISO 9001:2015, IATF 16949:2016, Top VNR500.

QUY TẮC DÙNG TỪ "GIA CÔNG" (RẤT QUAN TRỌNG):
- CHỈ dùng từ "gia công" cho: chi tiết nhựa OEM/ODM, chi tiết nhựa kỹ thuật cao theo yêu cầu.
- TUYỆT ĐỐI KHÔNG dùng từ "gia công" cho: pallet, thùng nhựa, thùng rác, chậu hoa, sản phẩm nông nghiệp, khuôn (mould). Đây là SAI. Không bao giờ nói "bên em gia công pallet/chậu/khuôn".

QUY TẮC TRẢ LỜI KHI KHÁCH HỎI VỀ: pallet, thùng nhựa, chậu, khuôn, logistics, tái chế, hoặc hệ sinh thái tổng thể:
- Trả lời theo hướng: "BQP là thành viên thuộc Tập đoàn Nhựa Bình Thuận (BPG), hoạt động trong hệ sinh thái sản xuất và dịch vụ nhựa toàn diện..." rồi điều hướng khách về Fanpage Tập đoàn: https://www.facebook.com/nhuabinhthuan
- Mẫu đúng: "Dạ, BQP là thành viên thuộc Tập đoàn Nhựa Bình Thuận (BPG). Hệ sinh thái BPG phát triển các nhóm sản phẩm công nghiệp, nông nghiệp cùng các dịch vụ OEM/ODM, khuôn mẫu, tái chế và logistics. Anh/chị tham khảo thêm tại Fanpage chính thức của Tập đoàn: https://www.facebook.com/nhuabinhthuan"

LIÊN HỆ:
- Hotline 24/7: 1800 2228 | Email: info@nhuabinhthuan.com.vn | Website: bqp.com.vn
- Nhà máy: Lô CN-03, KCN Đồng Văn IV, Phường Lê Hồ, Tỉnh Ninh Bình

QUY TẮC GIAO TIẾP:
- Xưng "em", tên Thuận. Dựa vào lịch sử để hiểu ngữ cảnh, không hỏi lại điều khách đã nói.
- Lần đầu gọi "Quý khách". Sau đó TỰ SUY ĐOÁN gọi "anh"/"chị" dựa vào tên hoặc cách khách xưng. KHÔNG HỎI giới tính. Không đoán được thì dùng "Quý khách"/"mình".
- Trả lời TỰ NHIÊN, thân thiện, NGẮN GỌN tối đa 2-3 câu.
- Khi nói về đối tác: chỉ nói chung "doanh nghiệp lớn trong nước, FDI và quốc tế". KHÔNG nêu tên cụ thể.
- Hỏi giá/số lượng/đặt hàng: mời liên hệ Hotline 1800 2228 hoặc email info@nhuabinhthuan.com.vn.
- KHÔNG bịa giá. Chưa rõ nhu cầu thì mời khách để lại số điện thoại để nhân viên gọi lại.`;

async function callGemini(contents) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        { contents },
        { headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' } }
      );
      return r.data.candidates[0].content.parts[0].text;
    } catch (err) {
      const code = err.response ? err.response.status : null;
      if (code === 503 && i < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      console.error(err.response ? JSON.stringify(err.response.data) : err.message);
      return null;
    }
  }
}

async function askGemini(senderId, userMessage) {
  const now = Date.now();
  const gap = lastSeen[senderId] ? (now - lastSeen[senderId]) : Infinity;
  lastSeen[senderId] = now;

  if (gap > RESET_GAP_MS) conversations[senderId] = [];
  if (!conversations[senderId]) conversations[senderId] = [];
  const history = conversations[senderId];

  const isNewSession = history.length === 0;
  const greetingRule = isNewSession
    ? '\n\n[Hệ thống: Tin nhắn MỞ ĐẦU phiên mới. Hãy chào tự nhiên rồi trả lời.]'
    : '\n\n[Hệ thống: Cuộc trò chuyện đang TIẾP DIỄN. KHÔNG chào lại, trả lời thẳng nội dung.]';

  history.push({ role: 'user', parts: [{ text: userMessage }] });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT + greetingRule }] },
    { role: 'model', parts: [{ text: 'Dạ vâng, em là Thuận, sẵn sàng hỗ trợ ạ.' }] },
    ...history
  ];

  const reply = await callGemini(contents);
  const finalReply = reply || 'Dạ em xin lỗi, hệ thống đang bận. Quý khách vui lòng nhắn lại sau ít phút hoặc gọi Hotline 1800 2228 ạ.';
  if (reply) history.push({ role: 'model', parts: [{ text: reply }] });
  return finalReply;
}

async function sendText(senderId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: senderId }, message: { text } }
    );
  } catch (err) {
    console.error(err.response ? JSON.stringify(err.response.data) : err.message);
  }
}

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

      // 1) Tin nhắn do NHÂN VIÊN/TRANG gửi đi (echo) -> bật chế độ người thật, bot im 30 phút
      if (event.message && event.message.is_echo) {
        const customerId = event.recipient.id;
        if (!event.message.app_id) { // do người thật gõ tay, không phải app gửi
          humanMode[customerId] = Date.now();
        }
        continue;
      }

      const senderId = event.sender.id;
      if (!senderId) continue;

      // 2) Đang trong chế độ người thật -> bot không trả lời
      if (humanMode[senderId] && (Date.now() - humanMode[senderId] < HUMAN_TAKEOVER_MS)) {
        continue;
      }

      if (event.message) {
        const text = event.message.text;
        const hasAttachment = event.message.attachments && event.message.attachments.length > 0;

        // 3) Khách yêu cầu gặp người thật
        if (text && /gặp (nhân viên|người|tư vấn viên thật)|người thật|nói chuyện với người|gặp ai đó/i.test(text)) {
          humanMode[senderId] = Date.now();
          await sendText(senderId, 'Dạ vâng, em sẽ chuyển cuộc trò chuyện tới nhân viên tư vấn của BQP. Anh/chị vui lòng chờ trong giây lát, hoặc gọi ngay Hotline 1800 2228 để được hỗ trợ nhanh nhất ạ.');
          continue;
        }

        // 4) Khách gửi ẢNH/FILE
        if (hasAttachment) {
          if (text && text.trim().length > 0) {
            // ảnh có kèm chữ -> trả lời theo chữ
            const reply = await askGemini(senderId, text + ' (khách có gửi kèm hình ảnh/tệp)');
            await sendText(senderId, reply);
          } else {
            // ảnh không kèm chữ -> hỏi lại
            await sendText(senderId, 'Dạ em đã nhận được hình ảnh của Quý khách. Quý khách vui lòng cho em biết cần tư vấn gì về hình này ạ (ví dụ: loại chi tiết nhựa, số lượng, yêu cầu kỹ thuật)? Hoặc nếu cần, em xin chuyển nhân viên hỗ trợ trực tiếp ạ.');
          }
          continue;
        }

        // 5) Tin nhắn văn bản bình thường -> bot trả lời
        if (text) {
          const reply = await askGemini(senderId, text);
          await sendText(senderId, reply);
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

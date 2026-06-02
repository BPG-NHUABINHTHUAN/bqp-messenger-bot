const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const conversations = {};
const lastSeen = {};
const MAX_HISTORY = 12;
const RESET_GAP_MS = 6 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `Bạn tên là Thuận, là nhân viên tư vấn (xưng "em") của Công ty Cổ phần Nhựa Chất Lượng Cao Bình Thuận (BQP) – thành viên Tập đoàn Nhựa Bình Thuận (BPG). Bạn am hiểu về gia công chi tiết nhựa kỹ thuật cao (OEM).

ĐỊNH VỊ CỐT LÕI CỦA BQP:
BQP chuyên gia công sản xuất chi tiết nhựa chất lượng cao theo yêu cầu (OEM). Mọi sản phẩm liên quan đến chi tiết nhựa, BQP đều có năng lực sản xuất và gia công. BQP là đối tác sản xuất tin cậy của nhiều doanh nghiệp lớn trong nước, các doanh nghiệp FDI và đối tác quốc tế. BQP chỉ tập trung vào chi tiết nhựa.

DOANH NGHIỆP NIÊM YẾT:
- BQP là công ty đại chúng, cổ phiếu mã BQP đã niêm yết/giao dịch trên sàn UPCoM (HNX) từ 05/11/2025, vốn điều lệ 150 tỷ đồng, đang chuyển niêm yết lên HOSE.
- Định hướng sản xuất tuần hoàn, phát triển bền vững theo chuẩn ESG.

NĂNG LỰC & THẾ MẠNH:
- Hệ thống máy ép phun 100% mới từ Haitian, Borche, Woojin; dây chuyền tự động, kiểm soát kích thước chính xác cao.
- Công suất khoảng 24 triệu sản phẩm/năm.
- Chứng nhận: ISO 9001:2015, IATF 16949:2016 (chuẩn quản lý chất lượng ngành ô tô toàn cầu), Top VNR500.

SẢN PHẨM OEM CHỦ LỰC:
- Linh kiện ô tô (đạt chuẩn IATF 16949), linh kiện xe máy, scooter.
- Linh kiện gia dụng: bình nóng lạnh, máy hút bụi cầm tay, quạt điều hòa, tủ lạnh.
- Mọi chi tiết nhựa khác theo yêu cầu.

HỆ SINH THÁI TẬP ĐOÀN NHỰA BÌNH THUẬN (BPG) – BQP VẪN NHẬN GIA CÔNG:
- Công nghiệp: pallet nhựa, thùng nhựa (sóng bít, sóng hở, thùng A, thùng B), thùng rác.
- Nông nghiệp: chậu hoa, chậu cây, chậu ươm, thiết bị chăn nuôi, lồng gà, vỉ trứng, sàn nhựa.
- Khuôn (mould).

LIÊN HỆ:
- Hotline 24/7: 1800 2228
- Email: info@nhuabinhthuan.com.vn
- Website: bqp.com.vn
- Nhà máy: Lô CN-03, KCN Đồng Văn IV, Phường Lê Hồ, Tỉnh Ninh Bình

QUY TẮC TRẢ LỜI:
- Xưng "em", tên là Thuận.
- Dựa vào lịch sử hội thoại để hiểu ngữ cảnh, không hỏi lại thông tin khách đã cung cấp.
- Lần đầu chưa biết giới tính khách thì gọi "Quý khách". Sau đó TỰ SUY ĐOÁN gọi "anh" hoặc "chị" dựa vào tên hoặc cách khách tự xưng. TUYỆT ĐỐI KHÔNG HỎI giới tính/cách xưng hô. Không đoán được thì dùng "Quý khách" hoặc "mình".
- Trả lời TỰ NHIÊN như người thật đang nhắn tin, thân thiện, gần gũi, KHÔNG máy móc.
- TRẢ LỜI NGẮN GỌN, tối đa 2-3 câu. Không liệt kê dài dòng trừ khi khách yêu cầu.
- Khi nói về đối tác: chỉ nói chung "doanh nghiệp lớn trong nước, doanh nghiệp FDI và đối tác quốc tế". KHÔNG nêu tên đối tác cụ thể.
- Khách hỏi pallet, thùng, chậu, khuôn: cho biết thuộc hệ sinh thái Tập đoàn BPG và BQP nhận gia công.
- Khách hỏi cổ phiếu, niêm yết: cho biết BQP đã niêm yết trên UPCoM (mã BQP), mời xem mục Quan hệ cổ đông tại bqp.com.vn.
- BQP CHỈ làm chi tiết nhựa. Hỏi gì không phải nhựa thì lịch sự nói không thuộc lĩnh vực của BQP.
- Hỏi giá/số lượng/đặt hàng: mời liên hệ Hotline 1800 2228 hoặc email info@nhuabinhthuan.com.vn để báo giá.
- KHÔNG bịa giá. Chưa rõ nhu cầu thì mời khách để lại số điện thoại để nhân viên gọi lại.`;

async function askGemini(senderId, userMessage) {
  const now = Date.now();
  const gap = lastSeen[senderId] ? (now - lastSeen[senderId]) : Infinity;
  lastSeen[senderId] = now;

  if (gap > RESET_GAP_MS) {
    conversations[senderId] = [];
  }
  if (!conversations[senderId]) conversations[senderId] = [];
  const history = conversations[senderId];

  const isNewSession = history.length === 0;
  const greetingRule = isNewSession
    ? '\n\n[Hệ thống: Đây là tin nhắn MỞ ĐẦU một phiên trò chuyện mới. Hãy chào khách một cách tự nhiên rồi trả lời.]'
    : '\n\n[Hệ thống: Cuộc trò chuyện đang TIẾP DIỄN. TUYỆT ĐỐI KHÔNG chào lại, trả lời thẳng vào nội dung như đang nói chuyện liên tục.]';

  history.push({ role: 'user', parts: [{ text: userMessage }] });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT + greetingRule }] },
    { role: 'model', parts: [{ text: 'Dạ vâng, em là Thuận, em đã sẵn sàng hỗ trợ ạ.' }] },
    ...history
  ];

  for (let i = 0; i < 3; i++) {
    try {
      const aiResponse = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        { contents },
        { headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' } }
      );
      const reply = aiResponse.data.candidates[0].content.parts[0].text;
      history.push({ role: 'model', parts: [{ text: reply }] });
      return reply;
    } catch (err) {
      const code = err.response ? err.response.status : null;
      if (code === 503 && i < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      console.error(err.response ? JSON.stringify(err.response.data) : err.message);
      return 'Dạ em xin lỗi, hệ thống đang bận. Quý khách vui lòng nhắn lại sau ít phút hoặc gọi Hotline 1800 2228 để được hỗ trợ ngay ạ.';
    }
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
      const senderId = event.sender.id;
      if (event.message && event.message.text) {
        const reply = await askGemini(senderId, event.message.text);
        try {
          await axios.post(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            { recipient: { id: senderId }, message: { text: reply } }
          );
        } catch (err) {
          console.error(err.response ? JSON.stringify(err.response.data) : err.message);
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

# TrickLo - AI Assistant 🤖

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow.svg)

> Trợ lý AI thông minh - Quét câu hỏi từ màn hình và nhận đáp án nhanh chóng với giao diện trong suốt hiện đại

## ✨ Tính năng

### 🎯 Chế độ Bôi đen Text
- Bôi đen văn bản hoặc câu hỏi trên trang web
- AI sẽ phân tích và đưa ra câu trả lời ngay lập tức
- Hỗ trợ nhiều ngôn ngữ (Việt, Anh, v.v.)

### 📸 Chế độ Chụp Ẩn Danh (Screenshot OCR)
**Tính năng đột phá cho việc học tập:**
- **Ctrl+Shift+S** - Bắt đầu chọn vùng chụp
- **Ctrl+S** - Lưu khung đã chọn
- **ESC** - Ẩn/hiện khung (hoàn toàn vô hình)
- **S** - Chụp và phân tích câu hỏi

> 💡 **Stealth Mode**: Khung chụp có thể ẩn hoàn toàn, không ai biết bạn đang chụp! 😎

### 🎨 Giao diện Crystal Glass
- Thiết kế trong suốt như pha lê
- Hiệu ứng frosted glass (kính mờ)
- Text embossed (nổi 3D)
- Animation mượt mà, hiện đại

### 🤖 Tích hợp Gemini Vision API
- Phân tích ảnh chụp màn hình
- Nhận diện câu hỏi trắc nghiệm
- Tự động đưa ra đáp án và giải thích
- Hỗ trợ nhiều câu hỏi cùng lúc

## 🚀 Cài đặt

### 1. Clone Repository
```bash
git clone https://github.com/bbqqvv/TrickLo.git
cd TrickLo
```

### 2. Lấy API Key từ Google AI Studio
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Tạo API key mới
3. Sao chép API key

### 3. Cài đặt Extension
1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **Load unpacked**
4. Chọn thư mục `TrickLo` vừa clone
5. Click vào icon extension và dán API key
6. Nhấn **Lưu cấu hình**

## 📖 Hướng dẫn sử dụng

### Phương pháp 1: Bôi đen Text
1. Bôi đen văn bản hoặc câu hỏi trên trang web
2. AI sẽ tự động phân tích và hiển thị đáp án
3. Click vào biểu tượng nổi để xem thêm tùy chọn

### Phương pháp 2: Chụp Ẩn Danh
1. **Nhấn Ctrl+Shift+S** để bắt đầu
2. **Kéo chuột** chọn vùng chứa câu hỏi
3. **Nhấn Ctrl+S** để lưu khung
4. **Nhấn ESC** để ẩn khung (không ai nhìn thấy)
5. **Nhấn S** để chụp và nhận đáp án

> ⚡ **Pro Tip**: Sau khi setup khung, bạn có thể ẩn hoàn toàn và chỉ cần nhấn phím **S** để chụp lại nhiều lần!

## 🎨 Screenshots

### Giao diện chính
![Popup UI](https://via.placeholder.com/600x400?text=Crystal+Glass+UI)

### Chế độ Chụp Ẩn Danh
![Screenshot Mode](https://via.placeholder.com/600x400?text=Stealth+Screenshot+Mode)

### AI Bubble
![AI Response](https://via.placeholder.com/600x400?text=AI+Response+Bubble)

## 🛠️ Công nghệ sử dụng

### Frontend
- **HTML5/CSS3** - Giao diện hiện đại
- **JavaScript (ES6+)** - Logic xử lý
- **Chrome Extension API** - Tích hợp trình duyệt

### Backend/AI
- **Gemini 2.0 Flash API** - AI text generation
- **Gemini Vision API** - OCR & image analysis
- **Chrome Screenshot API** - Chụp màn hình

### Design
- **Frosted Glass Effect** - `backdrop-filter: blur(120px)`
- **Embossed Text** - Multi-layer `text-shadow`
- **CSS Animations** - Smooth transitions

## 📂 Cấu trúc Project

```
TrickLo/
├── manifest.json          # Extension configuration
├── background.js          # Service worker, API calls
├── content.js             # Content script, UI logic
├── content.css            # Styling for injected UI
├── popup.html             # Extension popup
├── popup.js               # Popup logic
├── create-icons.html      # Icon generator
├── icon16.png             # Extension icons
├── icon48.png
├── icon128.png
└── README.md              # This file
```

## ⚙️ Cấu hình

### Permissions
- `contextMenus` - Menu chuột phải
- `storage` - Lưu API key
- `activeTab` - Chụp màn hình
- `scripting` - Inject content script

### Host Permissions
- `https://generativelanguage.googleapis.com/*` - Gemini API

## 🔐 Bảo mật

- ✅ API key được lưu local (Chrome Storage)
- ✅ Không gửi dữ liệu đến server bên thứ 3
- ✅ Chỉ gửi ảnh/text đến Gemini API
- ✅ Content Security Policy được tuân thủ

## 🐛 Troubleshooting

### Extension không hoạt động?
1. Kiểm tra API key đã được lưu chưa
2. Reload extension trong `chrome://extensions/`
3. Reload lại trang web
4. Mở Console (F12) để xem lỗi

### Chụp màn hình bị lỗi?
1. Đảm bảo đã cấp quyền cho extension
2. Thử chọn vùng nhỏ hơn
3. Kiểm tra console logs

### API bị giới hạn?
- Gemini API có giới hạn miễn phí
- Thử lại sau vài phút
- Hoặc tạo API key mới

## 🎯 Roadmap

- [ ] Thêm chế độ Dark mode
- [ ] Hỗ trợ nhiều AI models (GPT, Claude)
- [ ] Export history câu hỏi/đáp án
- [ ] Chế độ học tập với flashcards
- [ ] Mobile extension (Firefox)

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy:

1. Fork project
2. Tạo branch mới (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📝 License

Dự án này được phát hành dưới giấy phép MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 👨‍💻 Tác giả

**bbqqvv**
- GitHub: [@bbqqvv](https://github.com/bbqqvv)
- Repository: [TrickLo](https://github.com/bbqqvv/TrickLo)

## 🙏 Cảm ơn

- [Google Gemini](https://ai.google.dev/) - AI API
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) - Documentation
- Cộng đồng developers Việt Nam ❤️

---

⭐ **Nếu thấy hữu ích, hãy cho project một star nhé!** ⭐


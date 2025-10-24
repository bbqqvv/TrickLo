// Background script - Xử lý context menu, screenshot OCR và gọi API Gemini

// Tạo context menu khi extension được cài đặt
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "askAI",
        title: "Ask AI",
        contexts: ["selection"]
    });
});

// Lắng nghe phím tắt screenshot
chrome.commands.onCommand.addListener((command) => {
    if (command === 'screenshot-ocr') {
        handleScreenshotOCR();
    }
});

// Lắng nghe message từ content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'askAI') {
        const question = request.question;
        const tabId = sender.tab.id;
        const isMiniAnswer = request.isMiniAnswer || false;
        const isBatchAnswer = request.isBatchAnswer || false;

        console.log("Received askAI request:", question.substring(0, 100));
        console.log("Mini answer mode:", isMiniAnswer);
        console.log("Batch answer mode:", isBatchAnswer);
    }

    // Handle screenshot capture request
    if (request.action === 'captureScreenshot') {
        const rect = request.rect;
        const tabId = sender.tab.id;

        console.log("📸 Received screenshot capture request");
        console.log("Rect:", rect);

        (async () => {
            try {
                // Capture visible tab
                console.log("📷 Capturing visible tab...");
                const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                    format: 'png'
                });
                console.log("✅ Screenshot captured, size:", Math.round(dataUrl.length / 1024), "KB");

                // Crop the image
                console.log("✂️ Cropping image...");
                const croppedDataUrl = await cropImage(dataUrl, rect);
                console.log("✅ Image cropped, size:", Math.round(croppedDataUrl.length / 1024), "KB");

                // Send to analyze
                chrome.storage.sync.get(['geminiApiKey'], async (result) => {
                    const apiKey = result.geminiApiKey;

                    if (!apiKey) {
                        console.error("❌ No API key found");
                        sendMessageToTab(tabId, {
                            action: "showError",
                            message: "⚠ Vui lòng cấu hình API key trong extension popup"
                        });
                        return;
                    }

                    try {
                        console.log("🔄 Calling Gemini Vision API...");
                        const startTime = Date.now();
                        const response = await analyzeImageWithGemini(croppedDataUrl, apiKey);
                        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

                        console.log(`✅ Got response in ${duration}s:`, response.substring(0, 100));

                        sendMessageToTab(tabId, {
                            action: "showResult",
                            question: "Kết quả từ ảnh",
                            answer: response,
                            isMiniAnswer: false
                        });
                    } catch (error) {
                        console.error("❌ Error analyzing screenshot:", error);
                        sendMessageToTab(tabId, {
                            action: "showError",
                            message: "❌ Lỗi: " + error.message
                        });
                    }
                });

            } catch (error) {
                console.error("❌ Error capturing screenshot:", error);
                sendMessageToTab(tabId, {
                    action: "showError",
                    message: "❌ Lỗi chụp màn hình: " + error.message
                });
            }
        })();

        return true;
    }

    // Handle screenshot analysis (legacy)
    if (request.action === 'analyzeScreenshot') {
        const imageData = request.imageData;
        const tabId = sender.tab.id;

        console.log("📸 Received screenshot analysis request");
        console.log("Image size:", Math.round(imageData.length / 1024), "KB");

        chrome.storage.sync.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;

            if (!apiKey) {
                console.error("❌ No API key found");
                sendMessageToTab(tabId, {
                    action: "showError",
                    message: "⚠ Vui lòng cấu hình API key trong extension popup"
                });
                return;
            }

            try {
                console.log("⏳ Sending loading message...");
                sendMessageToTab(tabId, {
                    action: "showLoading",
                    question: "Đang phân tích ảnh..."
                });

                console.log("🔄 Calling Gemini Vision API...");
                const startTime = Date.now();
                const response = await analyzeImageWithGemini(imageData, apiKey);
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);

                console.log(`✅ Got response in ${duration}s:`, response.substring(0, 100));

                sendMessageToTab(tabId, {
                    action: "showResult",
                    question: "Kết quả từ ảnh",
                    answer: response,
                    isMiniAnswer: false
                });
            } catch (error) {
                console.error("❌ Error analyzing screenshot:", error);
                sendMessageToTab(tabId, {
                    action: "showError",
                    message: "❌ Lỗi: " + error.message
                });
            }
        });

        return true;
    }

    if (request.action === 'askAI') {

        // Lấy API key từ storage hoặc dùng default
        chrome.storage.sync.get(['geminiApiKey'], async (result) => {
            // Sử dụng API key từ storage, nếu không có thì dùng default
            const apiKey = result.geminiApiKey;

            if (!apiKey) {
                console.log("No API key found");
                sendMessageToTab(tabId, {
                    action: "showError",
                    message: "⚠ Please configure API key in extension popup"
                });
                return;
            }

            console.log("Sending loading message...");
            sendMessageToTab(tabId, {
                action: "showLoading",
                question: question
            });

            try {
                console.log("Calling Gemini API...");
                const response = await callGeminiAPI(question, apiKey);
                console.log("Got response:", response);

                sendMessageToTab(tabId, {
                    action: "showResult",
                    question: question,
                    answer: response,
                    isMiniAnswer: isMiniAnswer,
                    isBatchAnswer: isBatchAnswer
                });
            } catch (error) {
                console.error("Error calling API:", error);
                sendMessageToTab(tabId, {
                    action: "showError",
                    message: `✗ Error: ${error.message}`,
                    isMiniAnswer: isMiniAnswer,
                    isBatchAnswer: isBatchAnswer
                });
            }
        });

        return true;
    }
});

// Xử lý khi người dùng click vào context menu (giữ lại như backup)
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "askAI") {
        const selectedText = info.selectionText;

        console.log("Ask AI clicked with text:", selectedText);

        // Lấy API key từ storage
        chrome.storage.sync.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;

            if (!apiKey) {
                console.log("No API key found");
                // Thông báo người dùng cần nhập API key
                sendMessageToTab(tab.id, {
                    action: "showError",
                    message: "⚠ Please configure API key in extension popup"
                });
                return;
            }

            console.log("Sending loading message...");
            // Hiển thị loading trên trang web
            sendMessageToTab(tab.id, {
                action: "showLoading",
                question: selectedText
            });

            // Gọi API Gemini
            try {
                console.log("Calling Gemini API...");
                const response = await callGeminiAPI(selectedText, apiKey);
                console.log("Got response:", response);

                // Gửi kết quả về content script để hiển thị
                sendMessageToTab(tab.id, {
                    action: "showResult",
                    question: selectedText,
                    answer: response
                });
            } catch (error) {
                console.error("Error calling API:", error);
                sendMessageToTab(tab.id, {
                    action: "showError",
                    message: `✗ Error: ${error.message}`
                });
            }
        });
    }
});

// Hàm helper để gửi message với error handling
function sendMessageToTab(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            console.log("Vui lòng reload trang web để content script hoạt động!");

            // Thử inject content script nếu chưa có
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).then(() => {
                console.log("Content script injected, retrying...");
                // Thử gửi lại message
                chrome.tabs.sendMessage(tabId, message);
            }).catch(err => {
                console.error("Cannot inject content script:", err);
            });
        }
    });
}

// Hàm gọi API Gemini
async function callGeminiAPI(question, apiKey) {
    // Sử dụng gemini-2.5-flash - model mới nhất
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    const prompt = `Bạn là trợ lý AI trả lời ngắn gọn, chính xác và dễ hiểu.
Người dùng hỏi: "${question}"
Hãy trả lời bằng ngôn ngữ của câu hỏi.`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || 'Không thể kết nối với Gemini API';

        // Kiểm tra lỗi quota
        if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
            throw new Error('⏳ API quota exceeded. Please wait a few minutes or use another API key.');
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();

    // Lấy text từ response
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('No response from AI');
    }
}

// Hàm xử lý screenshot OCR
async function handleScreenshotOCR() {
    try {
        // Lấy tab hiện tại
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            console.error("No active tab found");
            return;
        }

        // Gửi message để content script hiển thị overlay crop
        chrome.tabs.sendMessage(tab.id, {
            action: 'startScreenshotCrop'
        });

    } catch (error) {
        console.error("Error in handleScreenshotOCR:", error);
    }
}

// Hàm crop ảnh sử dụng createImageBitmap (work trong service worker)
async function cropImage(dataUrl, rect) {
    try {
        console.log("🖼️ Converting dataUrl to blob...");
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        console.log("✅ Blob created:", blob.size, "bytes");

        // Create ImageBitmap from blob
        console.log("🎨 Creating ImageBitmap...");
        const imageBitmap = await createImageBitmap(blob);
        console.log("✅ ImageBitmap created:", imageBitmap.width, "x", imageBitmap.height);

        // Create canvas and crop
        console.log("✂️ Creating OffscreenCanvas for cropping...");
        const canvas = new OffscreenCanvas(Math.floor(rect.width), Math.floor(rect.height));
        const ctx = canvas.getContext('2d');

        // Draw cropped region
        ctx.drawImage(
            imageBitmap,
            Math.floor(rect.left),
            Math.floor(rect.top),
            Math.floor(rect.width),
            Math.floor(rect.height),
            0,
            0,
            Math.floor(rect.width),
            Math.floor(rect.height)
        );

        console.log("🔄 Converting canvas to blob...");
        // Convert to blob then to data URL
        const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
        console.log("✅ Cropped blob created:", croppedBlob.size, "bytes");

        // Convert blob to data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log("✅ Data URL created");
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(croppedBlob);
        });
    } catch (error) {
        console.error("❌ Error in cropImage:", error);
        throw error;
    }
}

// Hàm phân tích ảnh với Gemini Vision API
async function analyzeImageWithGemini(imageData, apiKey) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    // Chuyển base64 image thành format Gemini yêu cầu
    // imageData format: "data:image/png;base64,..."
    const base64Image = imageData.split(',')[1];

    console.log("📝 Preparing prompt...");
    const prompt = `Phân tích ảnh chứa các câu hỏi trắc nghiệm tiếng Anh.

Với MỖI câu hỏi, hãy:
1. Đọc câu hỏi và các đáp án
2. Chọn đáp án đúng nhất
3. Giải thích ngắn gọn tại sao

Format trả lời:
---
Câu [số]: [nội dung câu hỏi]
✅ Đáp án: [A/B/C/D]
💡 Giải thích: [lý do]
---

Nếu có nhiều câu, làm lần lượt từng câu.`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Image
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 4096,
        }
    };

    console.log("📤 Sending request to Gemini API...");
    console.log("Request size:", JSON.stringify(requestBody).length, "bytes");

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log("📥 Got response status:", response.status);

        if (!response.ok) {
            const error = await response.json();
            console.error("API Error:", error);
            throw new Error(error.error?.message || 'Gemini API error');
        }

        const data = await response.json();
        console.log("📊 Response data:", data);

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            const result = data.candidates[0].content.parts[0].text;
            console.log("✅ Successfully got answer");
            return result;
        } else if (data.candidates && data.candidates[0]?.finishReason === 'SAFETY') {
            throw new Error('⚠️ Nội dung bị chặn bởi bộ lọc an toàn');
        } else {
            console.error("Unexpected response structure:", data);
            throw new Error('Không nhận được phản hồi từ AI');
        }
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}


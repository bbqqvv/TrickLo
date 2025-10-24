// Background script - Xử lý context menu và gọi API Gemini

// Tạo context menu khi extension được cài đặt
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "askAI",
        title: "Ask AI",
        contexts: ["selection"]
    });
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


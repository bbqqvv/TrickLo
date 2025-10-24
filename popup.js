// Popup script - Xử lý cấu hình API key

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('statusMessage');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    // Load API key đã lưu
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            updateStatus(true);
        } else {
            updateStatus(false);
        }
    });

    // Xử lý khi nhấn nút Save
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showStatus('❌ Vui lòng nhập API key!', 'error');
            return;
        }

        // Validate format API key
        if (apiKey.length < 20) {
            showStatus('❌ API key không hợp lệ. Vui lòng kiểm tra lại!', 'error');
            return;
        }

        // Save API key
        chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
            showStatus('✅ Đã lưu API key thành công!', 'success');
            updateStatus(true);

            // Test API key
            testApiKey(apiKey);
        });
    });

    // Cho phép Enter để lưu
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    // Hàm hiển thị status message
    function showStatus(message, type) {
        statusMessage.innerHTML = `<div class="status ${type}">${message}</div>`;

        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 5000);
    }

    // Update status
    function updateStatus(isConfigured) {
        if (isConfigured) {
            statusIndicator.classList.remove('not-configured');
            statusIndicator.classList.add('configured');
            statusText.textContent = 'Đã cấu hình';
        } else {
            statusIndicator.classList.remove('configured');
            statusIndicator.classList.add('not-configured');
            statusText.textContent = 'Chưa cấu hình';
        }
    }

    // Hàm test API key
    async function testApiKey(apiKey) {
        try {
            // Sử dụng gemini-2.5-flash - model mới nhất
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Test connection'
                        }]
                    }]
                })
            });

            if (response.ok) {
                showStatus('✅ API key hoạt động tốt! Extension đã sẵn sàng.', 'success');
            } else {
                const error = await response.json();
                showStatus(`⚠️ API key đã lưu nhưng có lỗi: ${error.error?.message || 'Lỗi không xác định'}`, 'error');
            }
        } catch (error) {
            showStatus('⚠️ Không thể kiểm tra API key. Vui lòng thử lại sau.', 'error');
        }
    }
});


// Content script - Hiển thị bubble kết quả trên trang web

console.log("TrickLo AI content script loaded!");

let currentBubble = null;
let floatingIcon = null;
let floatingMenu = null;
let selectedTextCache = '';

// Lắng nghe khi người dùng bôi đen text (selection change)
document.addEventListener('mouseup', (e) => {
    // Đợi một chút để selection hoàn tất
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        // Chỉ hiện icon nếu có text được chọn và không click vào icon/menu
        if (text.length > 0 &&
            (!floatingIcon || !floatingIcon.contains(e.target)) &&
            (!floatingMenu || !floatingMenu.contains(e.target))) {

            console.log("Text selected:", text);
            selectedTextCache = text;

            // Kiểm tra xem có phải nhiều câu hỏi trắc nghiệm không
            if (isMultipleQuestions(text)) {
                // Nếu là nhiều câu hỏi, xử lý batch
                autoGetBatchAnswers(text);
                return;
            }

            // Kiểm tra xem có phải câu hỏi trắc nghiệm đơn không
            if (isMultipleChoiceQuestion(text)) {
                // Nếu là câu hỏi trắc nghiệm, tự động gọi AI để lấy đáp án
                autoGetAnswer(text);
                return;
            }

            // Nếu không phải câu hỏi trắc nghiệm, hiện icon bình thường
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    showFloatingIcon(rect, text);
                }
            }
        }
    }, 10);
});

// Kiểm tra xem text có phải là nhiều câu hỏi trắc nghiệm không
function isMultipleQuestions(text) {
    // Đếm số lượng câu hỏi (có số thứ tự như 111, 112, v.v.)
    const questionNumbers = text.match(/^\d+[\.\)]\s*/gm);
    if (questionNumbers && questionNumbers.length >= 2) {
        return true;
    }

    // Hoặc đếm số lượng pattern câu hỏi
    const lines = text.split('\n');
    let questionCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Tìm dòng có 4 đáp án A, B, C, D
        if (line.match(/^[A-D][\.\)]/)) {
            let hasAllOptions = true;
            for (let j = i; j < Math.min(i + 4, lines.length); j++) {
                if (!lines[j].trim().match(/^[A-D][\.\)]/)) {
                    hasAllOptions = false;
                    break;
                }
            }
            if (hasAllOptions) {
                questionCount++;
                i += 3; // Skip next 3 lines
            }
        }
    }

    return questionCount >= 2;
}

// Kiểm tra xem text có phải là đáp án đơn lẻ không (chỉ A, B, C, hoặc D)
function isClickingOnAnswer(text) {
    // Check nếu text chỉ là một đáp án: A. something, B. something, etc
    const singleAnswerPattern = /^[A-D][\.\)]\s*.{1,200}$/;
    return singleAnswerPattern.test(text.trim());
}

// Tìm toàn bộ câu hỏi trắc nghiệm từ element được click
function findFullQuestion(clickedElement) {
    // Tìm element cha chứa toàn bộ câu hỏi
    let parent = clickedElement;
    let attempts = 0;

    while (parent && attempts < 10) {
        const text = parent.textContent || parent.innerText;

        // Kiểm tra xem có đủ các đáp án A, B, C, D không
        if (text && isMultipleChoiceQuestion(text)) {
            return text.trim();
        }

        parent = parent.parentElement;
        attempts++;
    }

    return null;
}

// Hiển thị bubble kiểm tra đáp án nhanh
function showAnswerCheckBubble(selectedAnswer, fullQuestion) {
    hideFloatingIcon();
    hideFloatingMenu();

    // Extract letter (A, B, C, D) from selected answer
    const answerLetter = selectedAnswer.match(/^([A-D])/)?.[1] || selectedAnswer.charAt(0).toUpperCase();

    // Hiển thị loading
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
    }

    // Tạo prompt cho AI
    const prompt = `You are a professional teacher. The student selected answer ${answerLetter} for this question:

${fullQuestion}

Requirements:
1. If answer ${answerLetter} is CORRECT: Reply "✓ Correct! Answer ${answerLetter} is right." and briefly explain (1-2 sentences).
2. If answer ${answerLetter} is WRONG: Reply "✗ Wrong! The correct answer is [X]." and briefly explain why.`;

    // Gọi API
    chrome.runtime.sendMessage({
        action: 'askAI',
        question: prompt,
        originalText: selectedAnswer
    });
}

// Lắng nghe double-click để hiện icon (backup)
document.addEventListener('dblclick', (e) => {
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0) {
            console.log("Double-clicked with selection:", text);
            selectedTextCache = text;

            // Lấy vị trí của selection
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    showFloatingIcon(rect, text);
                }
            }
        }
    }, 10);
});

// Ẩn icon và menu khi click ra ngoài hoặc bỏ chọn
document.addEventListener('mousedown', (e) => {
    // Nếu click vào icon hoặc menu thì không làm gì
    if ((floatingIcon && floatingIcon.contains(e.target)) ||
        (floatingMenu && floatingMenu.contains(e.target))) {
        return;
    }

    // Nếu không thì ẩn icon và menu
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        // Nếu không còn text được chọn thì ẩn
        if (text.length === 0) {
            hideFloatingIcon();
            hideFloatingMenu();
        }
    }, 10);
});

// Lắng nghe message từ background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);

    if (request.action === "startScreenshotCrop") {
        startScreenshotCropMode();
        return true;
    }

    if (request.action === "showLoading") {
        hideFloatingMenu();
        showBubble(request.question, "⏳ Đang xử lý...", true);
    } else if (request.action === "showResult") {
        // Nếu là batch answer mode (nhiều câu hỏi)
        if (request.isBatchAnswer) {
            const answers = request.answer.trim().split('\n').filter(line => line.trim());
            showBatchAnswerBubble(answers);
        }
        // Nếu là mini answer mode (câu hỏi trắc nghiệm đơn)
        else if (request.isMiniAnswer) {
            const answer = request.answer.trim().toUpperCase();
            const answerLetter = answer.match(/^([A-D])/)?.[1] || answer.charAt(0);

            // Chỉ hiện kết quả, không hiện loading trước đó
            if (answerLetter && /^[A-D]$/.test(answerLetter)) {
                showMiniAnswerBubble(answerLetter);
            } else {
                showMiniAnswerBubble("?");
            }
        } else {
            showBubble(request.question, request.answer, false);
        }
    } else if (request.action === "showError") {
        // Nếu lỗi với câu hỏi trắc nghiệm, hiện bubble lỗi
        if (request.isMiniAnswer) {
            // Tạo mini bubble lỗi
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                const errorBubble = document.createElement('div');
                errorBubble.className = 'tricklo-mini-answer error';
                errorBubble.textContent = '✗';
                errorBubble.title = request.message;

                document.body.appendChild(errorBubble);

                let top = rect.top + window.scrollY - errorBubble.offsetHeight - 10;
                let left = rect.right + window.scrollX + 10;

                if (left + errorBubble.offsetWidth > window.innerWidth) {
                    left = rect.left + window.scrollX - errorBubble.offsetWidth - 10;
                }
                if (top < window.scrollY) {
                    top = rect.bottom + window.scrollY + 10;
                }

                errorBubble.style.top = `${top}px`;
                errorBubble.style.left = `${left}px`;

                // Auto hide sau 3 giây
                setTimeout(() => {
                    errorBubble.style.opacity = '0';
                    errorBubble.style.transform = 'scale(0.8)';
                    setTimeout(() => errorBubble.remove(), 300);
                }, 3000);

                errorBubble.addEventListener('click', () => {
                    errorBubble.style.opacity = '0';
                    errorBubble.style.transform = 'scale(0.8)';
                    setTimeout(() => errorBubble.remove(), 300);
                });

                currentBubble = errorBubble;
            }
        } else {
            showErrorBubble(request.message);
        }
    }

    // Gửi response để confirm đã nhận message
    sendResponse({ received: true });
    return true;
});

// Hàm hiển thị floating icon
function showFloatingIcon(rect, text) {
    // Xóa icon và menu cũ nếu có
    hideFloatingIcon();
    hideFloatingMenu();

    // Tạo floating icon
    const icon = document.createElement('div');
    icon.className = 'tricklo-floating-icon';
    icon.title = 'Click to see options';

    icon.innerHTML = `
        <div class="tricklo-icon-inner">
            <svg class="tricklo-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
        </div>
    `;

    document.body.appendChild(icon);

    // Tính toán vị trí (hiện ở góc phải trên của selection)
    let top = rect.top + window.scrollY - 10;
    let left = rect.right + window.scrollX + 5;

    // Đảm bảo icon không vượt ra ngoài viewport
    if (left + 40 > window.innerWidth) {
        left = rect.left + window.scrollX - 45;
    }
    if (top < window.scrollY) {
        top = rect.bottom + window.scrollY + 5;
    }

    icon.style.top = `${top}px`;
    icon.style.left = `${left}px`;

    // Click vào icon để hiện menu
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        showFloatingMenu(rect, text);
    });

    floatingIcon = icon;
}

// Hàm ẩn floating icon
function hideFloatingIcon() {
    if (floatingIcon) {
        floatingIcon.remove();
        floatingIcon = null;
    }
}

// Hàm kiểm tra xem text có phải câu hỏi trắc nghiệm không
function isMultipleChoiceQuestion(text) {
    // Check for multiple choice patterns
    const patterns = [
        /[A-D]\.\s*.+/g,
        /[A-D]\)\s*.+/g,
        /^[A-D]\s*.+/gm
    ];

    for (let pattern of patterns) {
        const matches = text.match(pattern);
        if (matches && matches.length >= 2) {
            return true;
        }
    }

    return false;
}

// Hàm hiển thị floating menu với options
function showFloatingMenu(rect, text) {
    // Xóa menu cũ nếu có
    if (floatingMenu) {
        floatingMenu.remove();
    }

    // Kiểm tra xem có phải câu hỏi trắc nghiệm không
    const isMCQ = isMultipleChoiceQuestion(text);

    // Tạo floating menu
    const menu = document.createElement('div');
    menu.className = 'tricklo-floating-menu';

    // Tạo menu items dựa vào loại text
    let menuItems = '';

    if (isMCQ) {
        // Multiple choice option
        menuItems = `
            <div class="tricklo-menu-item featured" data-action="choose-answer">
                <svg class="tricklo-menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="tricklo-menu-text">Lấy đáp án</span>
            </div>
            <div class="tricklo-menu-divider"></div>
        `;
    }

    // Ask AI option
    menuItems += `
        <div class="tricklo-menu-item" data-action="quick-ask">
            <svg class="tricklo-menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
            <span class="tricklo-menu-text">Hỏi AI</span>
        </div>
    `;

    menu.innerHTML = menuItems;

    document.body.appendChild(menu);

    // Tính toán vị trí menu (hiện dưới icon nếu có, hoặc dưới selection)
    const menuRect = menu.getBoundingClientRect();
    let top, left;

    if (floatingIcon) {
        const iconRect = floatingIcon.getBoundingClientRect();
        top = iconRect.bottom + window.scrollY + 5;
        left = iconRect.left + window.scrollX - (menuRect.width / 2) + 20;
    } else {
        top = rect.bottom + window.scrollY + 8;
        left = rect.left + window.scrollX + (rect.width / 2) - (menuRect.width / 2);
    }

    // Đảm bảo menu không vượt ra ngoài viewport
    if (left + menuRect.width > window.innerWidth) {
        left = window.innerWidth - menuRect.width - 10;
    }
    if (left < 10) {
        left = 10;
    }

    if (top + menuRect.height > window.innerHeight + window.scrollY) {
        if (floatingIcon) {
            const iconRect = floatingIcon.getBoundingClientRect();
            top = iconRect.top + window.scrollY - menuRect.height - 5;
        } else {
            top = rect.top + window.scrollY - menuRect.height - 8;
        }
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    // Thêm event listeners cho các menu items
    menu.querySelectorAll('.tricklo-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const action = item.getAttribute('data-action');
            handleMenuAction(action, text);
        });
    });

    floatingMenu = menu;
}

// Hàm ẩn floating menu
function hideFloatingMenu() {
    if (floatingMenu) {
        floatingMenu.remove();
        floatingMenu = null;
    }
}

// Xử lý các action từ menu
function handleMenuAction(action, text) {
    console.log("Menu action:", action, "with text:", text);

    hideFloatingIcon();
    hideFloatingMenu();

    let prompt = '';

    switch (action) {
        case 'quick-ask':
            prompt = text;
            break;
        default:
            prompt = text;
            break;
    }

    // Gọi API qua background script
    chrome.runtime.sendMessage({
        action: 'askAI',
        question: prompt,
        originalText: text
    });
}

// Hàm xử lý nhiều câu hỏi cùng lúc
function autoGetBatchAnswers(questionsText) {
    console.log("Auto get batch answers for multiple questions");

    // Hiển thị loading
    hideFloatingIcon();
    hideFloatingMenu();

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        showBubble(
            "Đang phân tích nhiều câu hỏi...",
            "⏳ Đang xử lý, vui lòng chờ...",
            true
        );
    }

    // Tạo prompt yêu cầu AI trả lời nhiều câu
    const prompt = `You are a professional English teacher. Analyze the multiple choice questions below and provide ONLY the correct answers.

${questionsText}

IMPORTANT: 
- Reply with ONLY the answer letters in order, one per line
- Format: Just the letters A, B, C, or D
- No explanations, no question numbers, just answers
- Example format:
A
C
B

Your answers:`;

    // Gọi API
    chrome.runtime.sendMessage({
        action: 'askAI',
        question: prompt,
        originalText: questionsText,
        isBatchAnswer: true
    });
}

// Hàm tự động lấy đáp án khi bôi đen câu hỏi trắc nghiệm
function autoGetAnswer(questionText) {
    console.log("Auto get answer for question:", questionText.substring(0, 100));

    // KHÔNG hiển thị loading - xử lý âm thầm phía sau
    // Người dùng chỉ thấy kết quả cuối cùng

    // Tạo prompt yêu cầu AI chỉ trả lời chữ cái
    const prompt = `You are a professional teacher. Analyze the question below and select the correct answer.

${questionText}

IMPORTANT: Reply ONLY with a single letter: A, B, C, or D. No explanation.
Example: If the correct answer is B, just reply: B`;

    // Gọi API để lấy đáp án (âm thầm)
    chrome.runtime.sendMessage({
        action: 'askAI',
        question: prompt,
        originalText: questionText,
        isMiniAnswer: true
    });
}

// Hiển thị bubble với nhiều đáp án
function showBatchAnswerBubble(answers) {
    // Xóa bubble cũ nếu có
    if (currentBubble) {
        currentBubble.remove();
    }

    hideFloatingIcon();
    hideFloatingMenu();

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Tạo bubble với list đáp án
    const bubble = document.createElement('div');
    bubble.className = 'tricklo-ai-bubble batch-answers';

    // Format answers
    let answersHTML = answers.map((ans, idx) => {
        const letter = ans.trim().toUpperCase().charAt(0);
        if (/^[A-D]$/.test(letter)) {
            return `<div class="batch-answer-item">${idx + 1}. <span class="answer-letter">${letter}</span></div>`;
        }
        return '';
    }).filter(a => a).join('');

    bubble.innerHTML = `
    <div class="tricklo-bubble-header">
      <svg class="tricklo-bubble-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
      <span class="tricklo-bubble-title">Đáp án (${answers.length} câu)</span>
      <button class="tricklo-bubble-close" title="Đóng">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="tricklo-bubble-answer">
      <strong>Kết quả</strong>
      <div class="batch-answers-list">${answersHTML}</div>
    </div>
  `;

    document.body.appendChild(bubble);

    // Tính vị trí
    const bubbleRect = bubble.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;

    if (left + bubbleRect.width > window.innerWidth) {
        left = window.innerWidth - bubbleRect.width - 20;
    }
    if (left < 10) {
        left = 10;
    }

    if (top + bubbleRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - bubbleRect.height - 10;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    // Thêm event listener cho nút đóng
    const closeBtn = bubble.querySelector('.tricklo-bubble-close');
    closeBtn.addEventListener('click', () => {
        bubble.remove();
        currentBubble = null;
    });

    // Make bubble draggable
    makeBubbleDraggable(bubble);

    // Tự động đóng khi click ra ngoài
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 100);

    currentBubble = bubble;
}

// Hiển thị bubble đáp án mini (chỉ có A/B/C/D) - Chỉ hiện khi có kết quả
function showMiniAnswerBubble(answer) {
    // Xóa bubble cũ nếu có
    if (currentBubble) {
        currentBubble.remove();
    }

    hideFloatingIcon();
    hideFloatingMenu();

    // Lấy vị trí selection
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Tạo mini bubble
    const bubble = document.createElement('div');
    bubble.className = 'tricklo-mini-answer';
    bubble.textContent = answer;

    document.body.appendChild(bubble);

    // Tính vị trí (góc phải trên của selection)
    let top = rect.top + window.scrollY - bubble.offsetHeight - 10;
    let left = rect.right + window.scrollX + 10;

    // Đảm bảo không vượt viewport
    if (left + bubble.offsetWidth > window.innerWidth) {
        left = rect.left + window.scrollX - bubble.offsetWidth - 10;
    }
    if (top < window.scrollY) {
        top = rect.bottom + window.scrollY + 10;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    // Auto hide sau 6 giây
    setTimeout(() => {
        if (bubble && bubble.parentNode) {
            bubble.style.opacity = '0';
            bubble.style.transform = 'scale(0.8)';
            setTimeout(() => bubble.remove(), 300);
        }
    }, 6000);

    // Click để đóng
    bubble.addEventListener('click', () => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(0.8)';
        setTimeout(() => bubble.remove(), 300);
    });

    currentBubble = bubble;
}

// Hàm tìm và click vào element đáp án
function clickAnswerElement(answerLetter, questionText) {
    console.log("=== AUTO-CLICK DEBUG ===");
    console.log("Trying to click answer:", answerLetter);

    // Lấy selection để tìm vùng câu hỏi
    const selection = window.getSelection();
    let searchRoot = document.body;

    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;

        // Tìm element cha chứa câu hỏi
        let parent = container.nodeType === 3 ? container.parentElement : container;
        let attempts = 0;

        while (parent && attempts < 20) {
            const text = parent.textContent || parent.innerText || '';
            if (text && isMultipleChoiceQuestion(text)) {
                searchRoot = parent;
                console.log("Found question container:", parent);
                break;
            }
            parent = parent.parentElement;
            attempts++;
        }
    }

    console.log("Search root:", searchRoot);
    console.log("Search root HTML:", searchRoot.outerHTML?.substring(0, 500));

    // Tìm tất cả các element có thể click trong vùng câu hỏi
    const possibleElements = [
        ...searchRoot.querySelectorAll('input[type="radio"]'),
        ...searchRoot.querySelectorAll('input[type="checkbox"]'),
        ...searchRoot.querySelectorAll('button'),
        ...searchRoot.querySelectorAll('[role="radio"]'),
        ...searchRoot.querySelectorAll('[role="checkbox"]'),
        ...searchRoot.querySelectorAll('.answer'),
        ...searchRoot.querySelectorAll('.option'),
        ...searchRoot.querySelectorAll('label'),
        ...searchRoot.querySelectorAll('div[onclick]'),
        ...searchRoot.querySelectorAll('span[onclick]')
    ];

    console.log("Found possible elements:", possibleElements.length);

    let clicked = false;

    // Tìm element tương ứng với đáp án
    for (let element of possibleElements) {
        const elementText = (element.textContent || element.innerText || element.value || '').trim();
        const elementHTML = element.outerHTML || '';

        console.log("Checking element:", {
            tag: element.tagName,
            text: elementText.substring(0, 100),
            html: elementHTML.substring(0, 200)
        });

        // Check nhiều patterns với case-insensitive
        const patterns = [
            new RegExp(`^${answerLetter}[\\.\\.\\)\\:\\s]`, 'i'),  // A. hoặc A) hoặc A: hoặc A 
            new RegExp(`^\\s*${answerLetter}\\s*[\\.\\)]`, 'i'),   // có thể có space
            new RegExp(`answer[_-]?${answerLetter}\\b`, 'i'),      // answer-A, answer_A
            new RegExp(`option[_-]?${answerLetter}\\b`, 'i'),      // option-A
            new RegExp(`value\\s*=\\s*["']${answerLetter}["']`, 'i'),   // value="A"
            new RegExp(`data-answer\\s*=\\s*["']${answerLetter}["']`, 'i'), // data-answer="A"
            new RegExp(`id\\s*=\\s*["'][^"']*${answerLetter}[^"']*["']`, 'i'), // id="...A..."
        ];

        for (let pattern of patterns) {
            if (pattern.test(elementText) || pattern.test(elementHTML)) {
                console.log("✅ MATCHED! Pattern:", pattern, "Element:", element);

                // Highlight element trước khi click
                highlightElement(element);

                // Thử click
                setTimeout(() => {
                    try {
                        // Scroll element vào view
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Thử nhiều cách click
                        element.focus();
                        element.click();

                        // Nếu là input, set checked
                        if (element.type === 'radio' || element.type === 'checkbox') {
                            element.checked = true;
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                        }

                        // Nếu là label, tìm input liên kết
                        if (element.tagName === 'LABEL' && element.htmlFor) {
                            const input = document.getElementById(element.htmlFor);
                            if (input) {
                                input.checked = true;
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }

                        // Dispatch click event
                        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

                        console.log("✅ Clicked successfully!");

                        showBubble(
                            "Auto-select Answer",
                            `✅ Selected answer ${answerLetter}!\n\nPlease review before submitting.`,
                            false
                        );

                        clicked = true;
                        return true;
                    } catch (err) {
                        console.error("Click error:", err);
                    }
                }, 500);

                return true;
            }
        }
    }

    if (!clicked) {
        // Nếu không tìm thấy element để click
        console.log("❌ No matching element found");
        showBubble(
            "Cannot auto-select",
            `⚠ Cannot find element to click for answer ${answerLetter}.\n\n✓ Correct answer: ${answerLetter}\n\nPlease select manually.`,
            false
        );
    }

    return clicked;
}

// Highlight element trước khi click
function highlightElement(element) {
    const originalBorder = element.style.border;
    const originalBackground = element.style.background;

    element.style.border = '3px solid #f5576c';
    element.style.background = 'rgba(245, 87, 108, 0.1)';
    element.style.transition = 'all 0.3s';

    setTimeout(() => {
        element.style.border = originalBorder;
        element.style.background = originalBackground;
    }, 2000);
}


// Hàm hiển thị bubble
function showBubble(question, answer, isLoading) {
    // Xóa bubble cũ nếu có
    if (currentBubble) {
        currentBubble.remove();
    }

    // Lấy vị trí của selection
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Tạo bubble element
    const bubble = document.createElement('div');
    bubble.className = 'tricklo-ai-bubble';
    if (isLoading) {
        bubble.classList.add('loading');
    }

    bubble.innerHTML = `
    <div class="tricklo-bubble-header">
      <svg class="tricklo-bubble-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
      </svg>
      <span class="tricklo-bubble-title">AI Assistant</span>
      <button class="tricklo-bubble-close" title="Đóng">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="tricklo-bubble-question">
      <strong>Câu hỏi</strong>
      <div class="tricklo-question-text">${escapeHtml(question)}</div>
    </div>
    <div class="tricklo-bubble-answer">
      <strong>Trả lời</strong>
      <div class="tricklo-answer-text">${isLoading ? answer : formatAnswer(answer)}</div>
    </div>
  `;

    // Tính toán vị trí hiển thị
    document.body.appendChild(bubble);

    const bubbleRect = bubble.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;

    // Đảm bảo bubble không vượt ra ngoài viewport
    if (left + bubbleRect.width > window.innerWidth) {
        left = window.innerWidth - bubbleRect.width - 20;
    }
    if (left < 10) {
        left = 10;
    }

    // Nếu bubble quá cao, đưa lên trên selection
    if (top + bubbleRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - bubbleRect.height - 10;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    // Thêm event listener cho nút đóng
    const closeBtn = bubble.querySelector('.tricklo-bubble-close');
    closeBtn.addEventListener('click', () => {
        bubble.remove();
        currentBubble = null;
    });

    // Make bubble draggable
    makeBubbleDraggable(bubble);

    // Tự động đóng khi click ra ngoài
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 100);

    currentBubble = bubble;
}

// Hàm làm cho bubble có thể kéo được - Improved version
function makeBubbleDraggable(bubble) {
    const header = bubble.querySelector('.tricklo-bubble-header');
    let isDragging = false;
    let startX, startY;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', handleMouseDown);

    function handleMouseDown(e) {
        // Don't drag if clicking close button
        if (e.target.closest('.tricklo-bubble-close')) {
            return;
        }

        isDragging = true;

        // Get current bubble position
        const rect = bubble.getBoundingClientRect();

        // Calculate offset between mouse and bubble position
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        e.preventDefault();
    }

    function handleMouseMove(e) {
        if (!isDragging) return;

        e.preventDefault();

        // Calculate new position
        let newLeft = e.clientX - startX;
        let newTop = e.clientY - startY;

        // Get bubble dimensions
        const bubbleRect = bubble.getBoundingClientRect();

        // Keep within viewport boundaries
        const maxLeft = window.innerWidth - bubbleRect.width - 10;
        const maxTop = window.innerHeight - bubbleRect.height - 10;

        newLeft = Math.max(10, Math.min(newLeft, maxLeft));
        newTop = Math.max(10, Math.min(newTop, maxTop));

        // Apply position with scroll offset
        bubble.style.left = (newLeft + window.scrollX) + 'px';
        bubble.style.top = (newTop + window.scrollY) + 'px';
    }

    function handleMouseUp(e) {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

// Hàm hiển thị bubble lỗi
function showErrorBubble(message) {
    // Xóa bubble cũ nếu có
    if (currentBubble) {
        currentBubble.remove();
    }

    const selection = window.getSelection();
    let top = 100;
    let left = window.innerWidth / 2;

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        top = rect.bottom + window.scrollY + 10;
        left = rect.left + window.scrollX;
    }

    const bubble = document.createElement('div');
    bubble.className = 'tricklo-ai-bubble error';

    bubble.innerHTML = `
    <div class="tricklo-bubble-header">
      <svg class="tricklo-bubble-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span class="tricklo-bubble-title">Thông báo</span>
      <button class="tricklo-bubble-close" title="Đóng">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="tricklo-bubble-answer">
      <div class="tricklo-answer-text">${escapeHtml(message)}</div>
    </div>
  `;

    document.body.appendChild(bubble);

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    const closeBtn = bubble.querySelector('.tricklo-bubble-close');
    closeBtn.addEventListener('click', () => {
        bubble.remove();
        currentBubble = null;
    });

    // Make error bubble draggable too
    makeBubbleDraggable(bubble);

    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 100);

    currentBubble = bubble;
}

// Xử lý click ra ngoài bubble
function handleClickOutside(e) {
    if (currentBubble && !currentBubble.contains(e.target)) {
        currentBubble.remove();
        currentBubble = null;
        document.removeEventListener('click', handleClickOutside);
        window.removeEventListener('scroll', handleScroll);
    }
}

// Xử lý khi cuộn trang - removed to allow bubble to stay during scroll

// Escape HTML để tránh XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format câu trả lời (hỗ trợ markdown đơn giản)
function formatAnswer(text) {
    // Escape HTML trước
    let formatted = escapeHtml(text);

    // Chuyển đổi markdown đơn giản
    // Bold: **text** hoặc __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* hoặc _text_
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');

    // Code inline: `code`
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

// ========================================
// SCREENSHOT OCR FUNCTIONALITY
// ========================================

let screenshotOverlay = null;
let selectionBox = null;
let captureButton = null;
let savedRegion = null; // Lưu vùng đã setup
let startX = 0, startY = 0;
let isDrawing = false;
let isSetupMode = false; // true = đang setup, false = đã setup xong

// Bắt đầu chế độ crop screenshot
function startScreenshotCropMode() {
    // Nếu đã có vùng setup, chỉ cần chụp lại
    if (savedRegion && !isSetupMode) {
        captureRegion();
        return;
    }

    // Nếu chưa setup hoặc đang ở setup mode
    isSetupMode = true;
    // Tạo overlay toàn màn hình
    screenshotOverlay = document.createElement('div');
    screenshotOverlay.id = 'tricklo-screenshot-overlay';
    screenshotOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        cursor: crosshair;
        z-index: 2147483647;
    `;

    // Tạo hướng dẫn
    const instruction = document.createElement('div');
    instruction.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(120px);
        -webkit-backdrop-filter: blur(120px);
        color: rgba(0, 0, 0, 0.88);
        padding: 16px 24px;
        border-radius: 16px;
        font-size: 15px;
        font-weight: 600;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
        z-index: 2147483648;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
    `;
    instruction.id = 'tricklo-instruction';
    instruction.innerHTML = savedRegion ?
        '📸 Kéo chuột để chỉnh lại vùng • <strong>ESC</strong> để hủy' :
        '📸 Kéo chuột để chọn vùng câu hỏi • <strong>ESC</strong> để hủy';

    // Tạo selection box
    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
        position: fixed;
        border: 2px solid rgba(0, 122, 255, 0.9);
        background: rgba(0, 122, 255, 0.1);
        display: none;
        z-index: 2147483648;
        box-shadow: 
            0 0 0 2px rgba(255, 255, 255, 0.5),
            0 8px 24px rgba(0, 122, 255, 0.3);
    `;

    document.body.appendChild(screenshotOverlay);
    document.body.appendChild(instruction);
    document.body.appendChild(selectionBox);

    // Event listeners
    screenshotOverlay.addEventListener('mousedown', handleMouseDown);
    screenshotOverlay.addEventListener('mousemove', handleMouseMove);
    screenshotOverlay.addEventListener('mouseup', handleMouseUp);

    // ESC để hủy
    document.addEventListener('keydown', handleEscapeKey);
}

function handleMouseDown(e) {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
}

function handleMouseMove(e) {
    if (!isDrawing) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = currentX - startX;
    const height = currentY - startY;

    if (width < 0) {
        selectionBox.style.left = currentX + 'px';
        selectionBox.style.width = Math.abs(width) + 'px';
    } else {
        selectionBox.style.width = width + 'px';
    }

    if (height < 0) {
        selectionBox.style.top = currentY + 'px';
        selectionBox.style.height = Math.abs(height) + 'px';
    } else {
        selectionBox.style.height = height + 'px';
    }
}

async function handleMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = selectionBox.getBoundingClientRect();

    // Kiểm tra kích thước tối thiểu
    if (rect.width < 50 || rect.height < 50) {
        cleanupScreenshotMode();
        alert('Vùng chọn quá nhỏ. Vui lòng chọn vùng lớn hơn.');
        return;
    }

    // Lưu vùng tạm thời (chưa confirm)
    savedRegion = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    };

    // Cập nhật hướng dẫn
    updateInstruction('✅ Nhấn <strong>Ctrl+S</strong> để lưu khung • <strong>ESC</strong> để hủy');
}

function handleEscapeKey(e) {
    // Nếu đang setup mode
    if (isSetupMode) {
        if (e.key === 'Escape') {
            cleanupScreenshotMode();
        }

        // Ctrl+S để confirm và lưu khung
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (savedRegion) {
                confirmRegion();
            }
        }
    }
}

function cleanupScreenshotMode() {
    if (screenshotOverlay) {
        screenshotOverlay.remove();
        screenshotOverlay = null;
    }
    if (selectionBox && isSetupMode) {
        selectionBox.remove();
        selectionBox = null;
    }
    const instruction = document.getElementById('tricklo-instruction');
    if (instruction) {
        instruction.remove();
    }
    document.removeEventListener('keydown', handleEscapeKey);
    document.removeEventListener('keydown', handleGlobalKeys, true);
    isDrawing = false;
    isSetupMode = false;
}

// Update instruction text
function updateInstruction(text) {
    const instruction = document.getElementById('tricklo-instruction');
    if (instruction) {
        instruction.innerHTML = text;
    }
}

// Confirm region và setup controls
function confirmRegion() {
    if (!savedRegion) return;

    // Cleanup overlay và instruction
    if (screenshotOverlay) {
        screenshotOverlay.remove();
        screenshotOverlay = null;
    }
    const instruction = document.getElementById('tricklo-instruction');
    if (instruction) {
        instruction.remove();
    }

    document.removeEventListener('keydown', handleEscapeKey);
    isSetupMode = false;

    // Setup khung và controls ẩn
    setupHiddenCaptureMode();
}

// Setup hidden capture mode với phím tắt
function setupHiddenCaptureMode() {
    console.log("🔧 Setting up hidden capture mode");
    console.log("📍 Saved region:", savedRegion);

    // Tạo selection box ẩn
    if (!selectionBox) {
        selectionBox = document.createElement('div');
    }

    selectionBox.style.cssText = `
        position: fixed;
        left: ${savedRegion.left}px;
        top: ${savedRegion.top}px;
        width: ${savedRegion.width}px;
        height: ${savedRegion.height}px;
        border: 2px dashed rgba(0, 122, 255, 0.6);
        background: rgba(0, 122, 255, 0.05);
        z-index: 2147483640;
        pointer-events: none;
        display: none;
        box-shadow: 
            0 0 0 2px rgba(255, 255, 255, 0.3),
            0 4px 12px rgba(0, 122, 255, 0.2);
        transition: opacity 0.3s ease;
    `;

    if (!document.body.contains(selectionBox)) {
        document.body.appendChild(selectionBox);
        console.log("✅ Selection box added to DOM");
    }

    // Remove old listener first to prevent duplicates
    document.removeEventListener('keydown', handleGlobalKeys, true);

    // Listen to global keys with capture phase để ưu tiên
    document.addEventListener('keydown', handleGlobalKeys, true);
    console.log("✅ Global key listener registered (capture phase)");

    // Show notification
    showNotification('✅ Đã lưu khung! Nhấn <strong>ESC</strong> để hiện khung, <strong>S</strong> để chụp');
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(52, 199, 89, 0.95);
        backdrop-filter: blur(120px);
        -webkit-backdrop-filter: blur(120px);
        color: white;
        padding: 14px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(52, 199, 89, 0.4);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
        animation: slideInRight 0.3s ease;
    `;
    notification.innerHTML = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Handle global keys (ESC, S)
function handleGlobalKeys(e) {
    console.log("⌨️ Key pressed:", e.key, "Code:", e.code, "Target:", e.target.tagName);

    // ESC để toggle hiện/ẩn khung
    if (e.key === 'Escape') {
        console.log("👁️ Toggling box visibility");
        toggleBoxVisibility();
        e.preventDefault();
        e.stopPropagation();
    }

    // S để chụp
    if (e.key === 's' || e.key === 'S') {
        console.log("📸 S key detected");
        // Không chụp nếu đang typing trong input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            console.log("⚠️ Ignoring S key - in input field");
            return;
        }
        console.log("✅ Capturing region...");
        e.preventDefault();
        e.stopPropagation();
        captureRegion();
    }
}

// Chụp vùng đã setup
async function captureRegion() {
    console.log("📸 captureRegion called");
    console.log("Saved region:", savedRegion);

    if (!savedRegion) {
        console.error("❌ No saved region found!");
        alert('⚠️ Chưa có vùng được lưu. Vui lòng setup lại bằng Ctrl+Shift+S');
        return;
    }

    try {
        console.log("🔄 Starting screenshot capture...");
        await captureAndCropScreenshot(savedRegion);
    } catch (error) {
        console.error('❌ Error capturing region:', error);
        alert('Lỗi khi chụp: ' + error.message);
    }
}

// Toggle hiện/ẩn khung
function toggleBoxVisibility() {
    console.log("👁️ toggleBoxVisibility called");
    console.log("Selection box exists:", !!selectionBox);

    if (!selectionBox) {
        console.error("❌ No selection box found!");
        return;
    }

    const isHidden = selectionBox.style.display === 'none';
    console.log("Current state - hidden:", isHidden);

    if (isHidden) {
        selectionBox.style.display = 'block';
        showNotification('👁️ Đã hiện khung');
    } else {
        selectionBox.style.display = 'none';
        showNotification('🔒 Đã ẩn khung - Nhấn <strong>S</strong> để chụp');
    }
}

// Reset vùng chọn
function resetRegion() {
    closeControls();
    savedRegion = null;
    startScreenshotCropMode();
}

// Đóng controls
function closeControls() {
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    if (captureButton) {
        captureButton.remove();
        captureButton = null;
    }
    document.removeEventListener('keydown', handleGlobalKeys, true);
    savedRegion = null;
    showNotification('✕ Đã đóng chế độ chụp');
}

async function captureAndCropScreenshot(rect) {
    console.log("🎬 captureAndCropScreenshot started");
    console.log("📐 Capture rect:", rect);

    // Ẩn tạm selection box khi chụp
    const wasVisible = selectionBox && selectionBox.style.display !== 'none';
    if (selectionBox) {
        selectionBox.style.display = 'none';
        console.log("👻 Selection box hidden");
    }

    // Hiển thị loading
    console.log("⏳ Showing loading bubble...");
    showBubble("Đang chụp màn hình...", "⏳ Đang phân tích...", true);

    // Đợi một chút để UI update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        console.log("📸 Requesting screenshot from background...");

        // Gửi request đến background để capture screenshot
        chrome.runtime.sendMessage({
            action: 'captureScreenshot',
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                devicePixelRatio: window.devicePixelRatio
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("❌ Error sending capture request:", chrome.runtime.lastError);
                showBubble("Lỗi", "❌ " + chrome.runtime.lastError.message, false);
            } else {
                console.log("✅ Capture request sent successfully");
            }
        });

        // Khôi phục selection box về trạng thái cũ (vẫn ẩn nếu đã ẩn)
        if (selectionBox && !wasVisible) {
            selectionBox.style.display = 'none';
            console.log("🔄 Selection box kept hidden");
        }

    } catch (error) {
        console.error('❌ Error in captureAndCropScreenshot:', error);
        showBubble("Lỗi", "❌ " + error.message, false);

        // Khôi phục UI ngay cả khi lỗi
        if (selectionBox && !wasVisible) {
            selectionBox.style.display = 'none';
        }

        throw error;
    }
}


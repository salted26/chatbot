import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.21.0";

// 1. 설정 및 초기화
const API_KEY = "AIzaSyDR-_pCSoaexc9i7VEBljjWHhd_wuCm4oU"; 
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", // 사용 가능한 최신 모델 확인 필요
    generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
});

const chatWindow = document.getElementById("chat-window");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const loadingIndicator = document.getElementById("loading-indicator");

// 2. 메시지 추가 함수 (대사 구분 + 아이콘 바 + 저장 로직)
function appendMessage(className, text, shouldSave = true) {
    if (!text && className !== "bot-msg") return; // 빈 메시지 방지
    
    const div = document.createElement("div");
    
    if (className === "user-msg") {
        div.className = "user-msg";
        div.innerText = text;
        if (shouldSave) saveChatToLocal("user", text);
    } else {
        // 큰따옴표가 있으면 흰색(dialogue), 없으면 주황색(novel-text)
        div.className = text.includes('"') ? "dialogue" : "novel-text";
        div.innerText = text;
        
        const actionBar = document.createElement("div");
        actionBar.className = "action-bar";
        actionBar.innerHTML = `
            <span class="material-icons-outlined">bookmark_border</span>
            <span class="material-icons-outlined">chat_bubble_outline</span>
            <span class="material-icons-outlined">edit</span>
            <span class="material-icons-outlined">delete_outline</span>
        `;
        div.appendChild(actionBar);
        if (shouldSave && text) saveChatToLocal("model", text);
    }
    
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

// 3. 로컬 스토리지 저장 및 불러오기
function saveChatToLocal(role, text) {
    let history = JSON.parse(localStorage.getItem("novel_history") || "[]");
    history.push({ role, text });
    if (history.length > 50) history = history.slice(-50);
    localStorage.setItem("novel_history", JSON.stringify(history));
}

function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem("novel_history") || "[]");
    history.forEach(item => {
        appendMessage(item.role === "user" ? "user-msg" : "bot-msg", item.text, false);
    });
}

// 4. 핵심 전송 로직
async function startSendMessage() {
    const prompt = userInput.value.trim();
    if (!prompt) return;

    console.log("✅ 전송 시작:", prompt);

    // 사용자 메시지 표시
    appendMessage("user-msg", prompt);
    userInput.value = "";
    sendBtn.classList.remove("active");

    // 로딩 표시
    loadingIndicator.style.display = "flex";
    chatWindow.appendChild(loadingIndicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        // 기존 기록 가져와서 대화 맥락 유지
        const rawHistory = JSON.parse(localStorage.getItem("novel_history") || "[]");
        const apiHistory = rawHistory.slice(-10).map(item => ({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text }]
        }));

        const chatSession = model.startChat({ history: apiHistory });
        const result = await chatSession.sendMessageStream(prompt);
        
        let isFirst = true;
        let botDiv = null;
        let fullText = "";

        for await (const chunk of result.stream) {
            if (isFirst) {
                loadingIndicator.style.display = "none";
                botDiv = appendMessage("bot-msg", "", false); // 일단 빈 박스 생성
                isFirst = false;
            }
            const chunkText = chunk.text();
            fullText += chunkText;
            botDiv.innerHTML = fullText; // 텍스트 누적 출력
            
            // 아이콘 바 재부착 (bot-msg가 생성될 때 이미 actionBar가 들어가므로 텍스트만 갱신)
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
        
        // 마지막에 한 번 저장
        saveChatToLocal("model", fullText);

    } catch (error) {
        loadingIndicator.style.display = "none";
        console.error("Error:", error);
        appendMessage("bot-msg", "에러가 발생했습니다: " + error.message, false);
    }
}

// 5. 이벤트 연결 통합 (가장 안전한 방식)
document.addEventListener("DOMContentLoaded", () => {
    // 기존 기록 불러오기
    loadChatHistory();
    console.log("🚀 스크립트 및 히스토리 로드 완료");

    // 클릭 이벤트
    sendBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startSendMessage();
    });

    // 엔터키 이벤트
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            startSendMessage();
        }
    });

    // 버튼 활성화 효과
    userInput.addEventListener("input", () => {
        if (userInput.value.trim().length > 0) {
            sendBtn.classList.add("active");
        } else {
            sendBtn.classList.remove("active");
        }
    });
});
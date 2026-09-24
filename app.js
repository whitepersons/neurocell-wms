// app.js

// Запросы идут на локальный serverless-эндпоинт Vercel
const API_URL = '/api/chat';

function initSystem() {
    // Часы
    const clockEl = document.getElementById('system-clock');
    if (clockEl) {
        setInterval(() => {
            clockEl.textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false });
        }, 1000);
    }

    // Инкремент счетчика паллет
    const counter = document.getElementById('pallet-counter');
    if (counter) {
        let count = 142;
        setInterval(() => {
            count++;
            counter.textContent = count;
        }, 12000);
    }
}

const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');

function appendMessage(text, isUser = false) {
    if (!chatWindow) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isUser ? 'msg-op' : 'msg-sys'}`;

    // Форматирование переносов и жирного шрифта
    msgDiv.innerHTML = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendQuery(text) {
    if (!text || !text.trim()) return;

    appendMessage(text, true);
    if (chatInput) chatInput.value = '';

    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'msg msg-sys';
    typingDiv.id = typingId;
    typingDiv.innerHTML = '<em>ИИ-Диспетчер NeuroCell анализирует запрос...</em>';
    chatWindow.appendChild(typingDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json();
        const indicator = document.getElementById(typingId);
        if (indicator) indicator.remove();

        if (!response.ok || data.error) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        appendMessage(data.reply, false);

    } catch (err) {
        const indicator = document.getElementById(typingId);
        if (indicator) indicator.remove();
        appendMessage(`❌ Ошибка связи с API: ${err.message}`, false);
    }
}

window.sendMessage = function() {
    if (chatInput) sendQuery(chatInput.value);
};

window.sendQuickMessage = function(text) {
    sendQuery(text);
};

window.handleEnter = function(event) {
    if (event.key === 'Enter') sendMessage();
};

document.addEventListener('DOMContentLoaded', initSystem);
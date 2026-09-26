// app.js

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

window.acknowledgeAlert = function() {
    const cam3 = document.getElementById('cam-03');
    const bboxLabel = document.getElementById('cam-03-bbox-label');
    const incidentCounter = document.getElementById('incident-counter');
    const incidentLabel = document.getElementById('incident-label');
    const ackBtn = document.getElementById('btn-ack');

    if (cam3) {
        cam3.style.borderColor = 'var(--border-subtle)';
        const headerTag = cam3.querySelector('.cam-tag');
        if(headerTag) {
             headerTag.style.background = 'rgba(255, 255, 255, 0.94)';
             headerTag.style.color = '#0f172a';
             headerTag.textContent = 'CAM-03: СТЕЛЛАЖ В-06';
        }
        
        const bbox = cam3.querySelector('.bbox');
        if(bbox) {
            bbox.classList.remove('alarm');
        }
    }

    if (bboxLabel) {
        bboxLabel.textContent = '[PALLET #PL-8492 // VERIFIED B-06]';
    }

    if (incidentCounter) {
        incidentCounter.innerHTML = '0 <span style="color: var(--text-muted);">INCIDENTS</span>';
        incidentCounter.style.color = 'var(--text-main)';
    }

    if (incidentLabel) {
        incidentLabel.style.color = 'var(--text-muted)';
        const card = incidentLabel.closest('.kpi-card');
        if (card) {
             card.classList.remove('warn');
             card.style.borderColor = 'var(--border-subtle)';
             card.style.background = 'var(--bg-panel)';
        }
    }
    
    if(ackBtn) {
        ackBtn.style.display = 'none';
    }

    appendMessage(`**[СИСТЕМА]:** Тревога на CAM-03 квитирована. Паллета #PL-8492 зафиксирована в ячейке В-06. Статус в 1С:WMS обновлен (200 OK). Буфер транзакций (PostgreSQL) синхронизирован.`, false);
};


document.addEventListener('DOMContentLoaded', initSystem);
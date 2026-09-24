// api/chat.js
import https from 'node:https';

// Универсальный хелпер для безопасных HTTPS-запросов к серверам Сбера без блокировки по CA Минцифры
function makeHttpsRequest(url, options, data = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            rejectUnauthorized: false // КРИТИЧНО: игнорируем ошибку самоподписанного сертификата Минцифры
        };

        const req = https.request(reqOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                }
            });
        });

        req.on('error', (err) => reject(err));

        if (data) {
            req.write(data);
        }
        req.end();
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { message } = req.body || {};

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Поле message не может быть пустым' });
        }

        const credentials = process.env.GIGACHAT_CREDENTIALS;
        const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';

        if (!credentials) {
            return res.status(500).json({ error: 'В Vercel не задана переменная GIGACHAT_CREDENTIALS' });
        }

        // =========================================================
        // ШАГ 1: Авторизация OAuth2 в Сбере
        // =========================================================
        const rqUid = crypto.randomUUID();
        const tokenData = await makeHttpsRequest(
            'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'RqUID': rqUid,
                    'Authorization': `Basic ${credentials.trim()}`
                }
            },
            `scope=${encodeURIComponent(scope)}`
        );

        const accessToken = tokenData.access_token;

        // =========================================================
        // ШАГ 2: Запрос к модели GigaChat
        // =========================================================
        const systemPrompt = `Ты — ведущий ИИ-диспетчер и аналитик системы «ВижнЛогистик СМАРТ» на объекте NODE-NSK-01 [НОВОСИБИРСК-ЦЕНТР].
Ты опираешься на официальную БАЗУ ЗНАНИЙ и регламенты предприятия:

1. ОШИБКА ЯЧЕЙКИ В-04 (СОП-01):
- Паллета #PL-8492 (ШК: 4607001239845) ошибочно стоит в В-04 вместо плановой В-06.
- Первое действие: заблокировать ячейку В-04 в 1С:WMS от двойной загрузки (Safety Lock).
- Назначенный исполнитель: водитель ричтрака ID: 14 (зафиксирован на CAM-02).
- Задача: переставить паллету в В-06. Остановка конвейера не требуется.
- После переноса: дождаться статуса REST API 200 OK и квитировать тревогу. Эскалация начальнику смены — только если прошло > 15 минут.

2. ШЛЮЗ 1С:WMS (СОП-02):
- Штатная задержка 120 мс, очередь PostgreSQL: 0. При сбое включается автономный буфер (Local Spooling), склад не останавливать.

3. ПРАВИЛА КОММУНИКАЦИИ:
- Отвечай кратко, профессиональным языком диспетчера SCADA/WMS.
- Используй списки и четкие глаголы действия («1. Заблокируйте...», «2. Направьте...»).
- Если вопрос не касается склада, вежливо возвращай оператора к регламентам безопасности и учета ТМЦ.`;

        const chatPayload = JSON.stringify({
            model: 'GigaChat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.3,
            max_tokens: 1024
        });

        const chatData = await makeHttpsRequest(
            'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            },
            chatPayload
        );

        const replyText = chatData.choices[0].message.content;
        return res.status(200).json({ reply: replyText });

    } catch (err) {
        console.error('Ошибка в api/chat:', err);
        return res.status(500).json({ error: err.message });
    }
}
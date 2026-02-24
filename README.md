# OpenAI API Proxy

Прокси-сервис для OpenAI API. Принимает запросы в формате OpenAI и прозрачно пересылает их на `api.openai.com`, возвращая ответ без изменений. Подходит для любого клиента (Python `openai`, Node.js SDK и т.д.) — достаточно указать адрес этого сервера как `base_url`.

## Зачем это нужно

**Доступ к OpenAI из регионов, где он недоступен.**  
Если в вашей стране OpenAI заблокирован или работает нестабильно, можно поднять этот прокси на сервере в стране с доступом (VPS, облако). Все запросы к API будут идти через ваш прокси: клиент обращается к вашему домену, прокси — к OpenAI. Никаких VPN и системных прокси на машине разработчика не требуется — достаточно в коде указать URL прокси и свой ключ OpenAI в специальном формате.

Дополнительно прокси даёт защиту по префиксу токена: без знания вашего префикса к сервису не подключиться, даже зная адрес.

## Как пользоваться (клиент)

1. Получите URL прокси (например `https://your-proxy.example.com/v1` или `http://your-server:7388/v1`) и префикс токена у того, кто развернул прокси.
2. Вместо прямого вызова OpenAI подставьте в клиенте:
   - **base_url** — адрес прокси (с путём `/v1`);
   - **api_key** — строка вида `ВАШ_ПРЕФИКС:ВАШ_OPENAI_API_KEY` (префикс и ключ через двоеточие).

Примеры:

**Python (openai):**
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-proxy.example.com/v1",
    api_key="myproxy:sk-your-openai-api-key"
)
# Дальше как обычно
response = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": "Hi"}])
```

**Node.js:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-proxy.example.com/v1',
  apiKey: 'myproxy:sk-your-openai-api-key',
});
```

**Переменные окружения (Python):**
```bash
export OPENAI_BASE_URL=https://your-proxy.example.com/v1
export OPENAI_API_KEY=myproxy:sk-your-openai-api-key
```

Прокси вырежет префикс и отправит в OpenAI только ключ `sk-...`; ответ вернётся как при прямом обращении к API.

## Примеры с пакетами OpenAI

### Python (`openai`)

Установка: `pip install openai`

**Чат (обычный ответ):**
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-proxy.example.com/v1",
    api_key="myproxy:sk-your-openai-key",
)

r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Привет!"}],
    max_tokens=100,
)
print(r.choices[0].message.content)
```

**Чат со стримингом:**
```python
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Напиши короткое стихотворение"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

**Список моделей, эмбеддинги:**
```python
# Модели
models = client.models.list()
print([m.id for m in models.data[:5]])

# Эмбеддинги
emb = client.embeddings.create(model="text-embedding-3-small", input="Hello world")
print(emb.data[0].embedding[:3])
```

**Через переменные окружения (удобно для скриптов):**
```bash
export OPENAI_BASE_URL=https://your-proxy.example.com/v1
export OPENAI_API_KEY=myproxy:sk-your-openai-key
```
```python
from openai import OpenAI
client = OpenAI()  # возьмёт base_url и api_key из env
```

### Node.js (`openai`)

Установка: `npm install openai`

**Чат:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-proxy.example.com/v1',
  apiKey: 'myproxy:sk-your-openai-key',
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
  max_tokens: 100,
});
console.log(completion.choices[0].message.content);
```

**Стриминг:**
```javascript
const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Say hi' }],
  stream: true,
});
for await (const chunk of stream) {
  const text = chunk.choices[0]?.delta?.content;
  if (text) process.stdout.write(text);
}
```

**Эмбеддинги и модели:**
```javascript
const models = await client.models.list();
const emb = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Hello world',
});
```

### cURL (проверка с терминала)

```bash
curl -s "https://your-proxy.example.com/v1/models" \
  -H "Authorization: Bearer myproxy:sk-your-openai-key" | jq '.data[0].id'
```

### LangChain (Python)

LangChain умеет передавать `openai_api_base` и `openai_api_key`:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    openai_api_base="https://your-proxy.example.com/v1",
    openai_api_key="myproxy:sk-your-openai-key",
    model="gpt-4o-mini",
)
print(llm.invoke("Привет!"))
```

Аналогично можно задать `OPENAI_API_BASE` и `OPENAI_API_KEY` в окружении — многие библиотеки их подхватывают.

## Развёртывание (владелец прокси)

### Локально

```bash
cp .env.example .env
# Задайте PROXY_AUTH_PREFIX (например myproxy)
npm install
npm run start
```

Сервер слушает порт 3000. Все запросы к `/v1` и `/v1/*` проксируются на `https://api.openai.com/v1/*`.

### Docker

Nginx предполагается на хост-машине. В `docker-compose` включён **network_mode: host**: приложение слушает порт **7388** на хосте, исходящие запросы к OpenAI идут с хоста.

```bash
cp .env.example .env
# При необходимости задайте PORT=7388 и PROXY_AUTH_PREFIX
docker compose up -d --build
```

Прокси будет доступен на `http://localhost:7388/v1` (или за nginx на вашем домене).

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт сервера | 3000 |
| `OPENAI_BASE_URL` | Базовый URL OpenAI | https://api.openai.com |
| `PROXY_AUTH_PREFIX` | Префикс в токене; если задан, клиент обязан передавать `префикс:ключ` | (пусто — любой токен с `:` обрабатывается) |

Клиент передаёт: `Authorization: Bearer <ПРЕФИКС>:<OPENAI_API_KEY>`. Прокси проверяет префикс (если он задан) и в OpenAI отправляет только ключ.

## Тест (Python)

В папке `client-test/` — скрипт для проверки прокси.

```bash
cd client-test
pip install -r requirements.txt
export PROXY_BASE_URL=http://localhost:3000/v1
export PROXY_AUTH_PREFIX=myproxy
export OPENAI_API_KEY=sk-your-openai-key
python test_proxy.py
```

Перед запуском убедитесь, что прокси запущен и в `.env` на сервере задан тот же `PROXY_AUTH_PREFIX`.

# LLM Interaction Guesser API 调用 Prompt

请基于下面这段现有前端实现，提取并复现它调用 OpenAI-compatible API 的方式。目标不是改业务语义，而是忠实复刻它当前的接口组织方式、prompt 结构和返回解析约束。

## 目标

实现一个“根据用户在静态图表上的原始事件轨迹，推测其交互意图”的 API 调用流程。

## API 调用要求

1. 使用 OpenAI-compatible Chat Completions 接口。
2. 基础地址来自 `baseUrl`，真实请求地址为：
   - `GET {baseUrl}/models`
   - `POST {baseUrl}/chat/completions`
3. 请求头格式：

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer <apiKey>
```

4. `chat/completions` 的请求体必须包含：

```json
{
  "model": "<model>",
  "temperature": 0.2,
  "messages": [
    {
      "role": "system",
      "content": "You classify visualization interactions from short event traces and must respond with strict JSON only."
    },
    {
      "role": "user",
      "content": "<由 buildGuessPrompt(payload) 生成的完整文本>"
    }
  ]
}
```

## 用户消息 Prompt 模板

`user` 消息内容请严格按下面语义组织，可以保留英文原文：

```text
You are an interaction-intent recognition assistant for information visualization.
The user is looking at a static chart with no built-in interaction.
The user can only demonstrate their intended interaction through mouse movement, pauses, clicks, drags, wheel actions, and key combinations.
Based on the raw event trace, infer the primary interaction intent the user is trying to express.
Do not assume the chart has actually performed selection, zooming, or panning.

Candidate labels:
- hover_inspect: the user intends hover inspection or hover highlighting
- click_select: the user intends click selection
- brush_select: the user intends brush selection
- pan_navigate: the user intends pan navigation
- zoom_navigate: the user intends zoom navigation
- mixed_or_other: mixed behavior or another intent

Return JSON only. Do not use Markdown code fences. Use this schema:
{
  "label": "hover_inspect | click_select | brush_select | pan_navigate | zoom_navigate | mixed_or_other",
  "label_name": "short English label name",
  "confidence": 0.0,
  "reasoning": "one or two concise sentences",
  "evidence": ["up to 4 pieces of evidence"],
  "next_best_label": "backup label"
}

Interaction trace:
<payload 的 JSON 字符串，使用 JSON.stringify(payload, null, 2) 风格插入>
```

## payload 结构

传给 prompt 的 `payload` 应保持如下结构：

```json
{
  "task": "Infer the intended interaction that a user is demonstrating on a static visualization.",
  "scenario": "The chart is a static <chartLabel>. Behavior overlays visualize cursor, drag, wheel, and key activity so the user can perceive their own demonstration.",
  "chart": {
    "type": "<chartType>"
  },
  "events": []
}
```

其中：

- `chartLabel` 可能是 `scatter plot`、`bar chart`、`line chart`
- `chart.type` 可能是 `scatter`、`bar`、`line`
- `events` 来自录制到的用户原始操作轨迹

## 返回结果处理要求

1. 从返回值中读取：

```js
result?.choices?.[0]?.message?.content
```

2. 如果 `content` 是数组或分段内容，需要先归一化为纯文本。
3. 只信任 JSON 结果：
   - 先直接尝试 `JSON.parse`
   - 如果失败，可再尝试从 fenced code block 或首尾 `{...}` 中提取 JSON
4. 最终输出建议同时保留：
   - `raw`: 原始响应
   - `content`: 归一化后的文本
   - `parsed`: 解析出的 JSON 对象

## 代码实现约束

请产出一段清晰的实现代码，至少包含以下函数：

- `requestModelList({ baseUrl, apiKey })`
- `requestGuess({ baseUrl, apiKey, model, temperature, payload })`
- `buildGuessPrompt(payload)`
- `normalizeMessageContent(content)`
- `extractJsonObject(text)`

## 参考实现特征

- `baseUrl` 需要先做归一化，去掉结尾的 `/models`、`/chat/completions` 和多余 `/`
- `temperature` 取值被限制在 `0 ~ 1`
- 模型列表接口失败时要抛出带状态码的错误
- chat completion 接口失败时要抛出带状态码的错误
- 模型必须被约束为“strict JSON only”

## 参考源码位置

- `src/pages/_shared/llmInteractionGuesserPage.js`
- `src/pages/llm-interaction-guesser/llm-interaction-guesser.js`
- `src/pages/llm-interaction-guesser/private-config.local.js`


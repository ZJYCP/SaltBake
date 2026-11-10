import assert from "node:assert/strict";
import {
  CONFIG_DEFINITIONS,
  RUNTIME_CONFIG_KEYS,
  coerceConfigValue,
  maskConfigValue,
  serializeConfig,
  validateConfigValue,
} from "../src/lib/server/runtime-config";

assert.deepEqual(RUNTIME_CONFIG_KEYS, [
  "zhihu_cookie",
  "zhihu_access_token",
  "siliconflow_api_key",
  "crawler_user_agent",
  "request_delay_ms",
  "rate_limit_window_ms",
  "rate_limit_max_requests",
  "cookie_check_url",
]);

assert.equal(CONFIG_DEFINITIONS.zhihu_cookie.sensitive, true);
assert.equal(CONFIG_DEFINITIONS.zhihu_access_token.sensitive, true);
assert.equal(validateConfigValue("zhihu_access_token", " Bearer example-token "), null);
assert.equal(validateConfigValue("zhihu_access_token", ""), null);
assert.ok(validateConfigValue("zhihu_access_token", "bad\r\nInjected: header"));
assert.equal(serializeConfig("zhihu_access_token", "example-token").value, "");
assert.equal(CONFIG_DEFINITIONS.request_delay_ms.defaultValue, "3000");

assert.equal(coerceConfigValue("request_delay_ms", "1200"), 1200);
assert.equal(coerceConfigValue("request_delay_ms", "bad"), 3000);
assert.equal(coerceConfigValue("rate_limit_max_requests", ""), 10);
assert.equal(validateConfigValue("request_delay_ms", "1200"), null);
assert.equal(validateConfigValue("request_delay_ms", "100abc"), "请求间隔 必须是正整数");
assert.equal(validateConfigValue("rate_limit_max_requests", "0"), "限流次数 必须是正整数");
assert.equal(validateConfigValue("zhihu_cookie", ""), null);
assert.equal(
  coerceConfigValue("cookie_check_url", "https://example.com/check"),
  "https://example.com/check"
);

assert.equal(maskConfigValue("zhihu_cookie", ""), "");
assert.equal(maskConfigValue("zhihu_cookie", "short"), "***");
assert.equal(
  maskConfigValue("siliconflow_api_key", "sk-1234567890abcdef"),
  "sk-123456...90abcdef"
);
assert.equal(maskConfigValue("request_delay_ms", "3000"), "3000");
assert.equal(serializeConfig("zhihu_cookie", "secret-cookie").value, "");
assert.equal(
  serializeConfig("zhihu_cookie", "secret-cookie", { revealValue: true }).value,
  "secret-cookie"
);
assert.equal(serializeConfig("request_delay_ms", "3000").value, "3000");

console.log("runtime config contract ok");

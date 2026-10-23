// Обёртка над fetch: возвращает статус, разобранный JSON, исходный текст и заголовки.
import { API_URL } from "../setup/config.js";

export async function api(method, path, { token, body, raw, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (raw !== undefined) {
    init.body = raw;
    init.headers["Content-Type"] ??= "application/json";
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json, text, headers: response.headers };
}

export const get = (path, options) => api("GET", path, options);
export const post = (path, options) => api("POST", path, options);
export const patch = (path, options) => api("PATCH", path, options);
export const del = (path, options) => api("DELETE", path, options);

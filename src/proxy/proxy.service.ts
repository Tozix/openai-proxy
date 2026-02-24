import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosRequestConfig } from "axios";
import { Request, Response } from "express";

@Injectable()
export class ProxyService {
  private readonly openaiBaseUrl: string;
  private readonly proxyAuthPrefix: string;

  constructor(private readonly config: ConfigService) {
    this.openaiBaseUrl = this.config
      .get<string>("OPENAI_BASE_URL", "https://api.openai.com")
      .replace(/\/$/, "");
    this.proxyAuthPrefix = this.config.get<string>(
      "PROXY_AUTH_PREFIX",
      "myproxy",
    );
  }

  /**
   * Extracts OpenAI API key from Authorization header.
   * Expected format: "Bearer [PREFIX:]sk-..."
   * Если в токене есть ':', считаем часть до первого ':' префиксом и в OpenAI шлём только часть после ':'.
   * Если задан PROXY_AUTH_PREFIX — префикс в токене должен совпадать.
   */
  private extractOpenAiToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const colonIndex = token.indexOf(":");
    if (colonIndex !== -1) {
      const prefixPart = token.slice(0, colonIndex).trim();
      const openAiKey = token.slice(colonIndex + 1).trim();
      if (this.proxyAuthPrefix && prefixPart !== this.proxyAuthPrefix)
        return null;
      return openAiKey || null;
    }

    if (this.proxyAuthPrefix) return null;
    return token;
  }

  private copyForwardHeaders(
    req: Request,
    openAiToken: string,
  ): Record<string, string> {
    const forward: Record<string, string> = {};
    const skip = new Set(["host", "authorization", "connection"]);
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (skip.has(lower) || value === undefined) continue;
      forward[key] = Array.isArray(value) ? value.join(", ") : value;
    }
    forward["Authorization"] = `Bearer ${openAiToken}`;
    return forward;
  }

  async proxy(req: Request, res: Response): Promise<void> {
    const openAiToken = this.extractOpenAiToken(req.headers.authorization);
    if (!openAiToken) {
      res
        .status(401)
        .json({
          error: {
            message: "Invalid or missing proxy authorization",
            code: "invalid_proxy_auth",
          },
        });
      return;
    }

    const path = req.originalUrl || req.url;
    const url = `${this.openaiBaseUrl}${path}`;
    const method = (req.method || "GET").toUpperCase();
    const headers = this.copyForwardHeaders(req, openAiToken);

    let body: string | undefined;
    if (
      req.body !== undefined &&
      req.body !== null &&
      ["POST", "PUT", "PATCH"].includes(method)
    ) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      headers,
      data: body,
      validateStatus: () => true,
      maxRedirects: 0,
      timeout: 120000,
    };

    const isStreamRequest =
      typeof req.body === "object" && req.body?.stream === true;
    if (isStreamRequest) {
      config.responseType = "stream";
    }

    try {
      const response = await axios(config);

      res.status(response.status);
      const respHeaders = response.headers as Record<string, string>;
      const skipHeaders = new Set([
        "transfer-encoding",
        "connection",
        "keep-alive",
      ]);
      for (const [key, value] of Object.entries(respHeaders)) {
        const lower = key.toLowerCase();
        if (skipHeaders.has(lower)) continue;
        if (value !== undefined) res.setHeader(key, value);
      }

      if (response.data && typeof response.data.pipe === "function") {
        response.data.pipe(res);
      } else {
        res.send(response.data);
      }
    } catch (err: unknown) {
      const status =
        axios.isAxiosError(err) && err.response?.status
          ? err.response.status
          : 502;
      const message = axios.isAxiosError(err)
        ? err.message || "Upstream error"
        : "Proxy error";
      res.status(status).json({ error: { message, code: "proxy_error" } });
    }
  }
}

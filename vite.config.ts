import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PROJECT_ROOT = process.cwd();

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function runCameraE2ESimulation(requestBody: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const runnerPath = path.join(PROJECT_ROOT, "scripts", "camera_e2e_live_runner.py");
    const child = spawn("python3", [runnerPath, "--request", "-"], {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(requestBody);
  });
}

function cameraE2EApiPlugin(): Plugin {
  return {
    name: "sinclair-camera-e2e-api",
    configureServer(server) {
      server.middlewares.use("/api/camera-e2e/run", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { status: "failed", reason: "POST required" });
          return;
        }

        try {
          const requestBody = await readBody(request);
          JSON.parse(requestBody);
          const result = await runCameraE2ESimulation(requestBody);
          const payload = result.stdout ? JSON.parse(result.stdout) : { status: "failed", reason: "empty runner output" };
          if (result.code === 0) {
            sendJson(response, 200, payload);
            return;
          }
          sendJson(response, 500, { ...payload, stderr: result.stderr, returncode: result.code });
        } catch (error) {
          sendJson(response, 500, {
            status: "failed",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cameraE2EApiPlugin()],
});

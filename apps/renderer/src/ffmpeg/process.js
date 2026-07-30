import { spawn } from "node:child_process";

const MAX_CAPTURED_STDERR = 96 * 1024;

export async function runProcess(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-MAX_CAPTURED_STDERR);
      options.onStderr?.(chunk.toString());
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} exited with ${code ?? `signal ${signal}`}: ${stderr.trim() || "no stderr"}`,
        ),
      );
    });
  });
}


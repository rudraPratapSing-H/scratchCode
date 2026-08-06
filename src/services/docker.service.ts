import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContainerPoolService } from './container-pool.service.ts';
import type { SupportedLanguage } from './container-pool.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

export const DockerService = {
    /**
     * Executes code using a pre-warmed container if available, falling back to a cold start.
     */
    async executeContainer(
        submissionId: string, 
        language: string, 
        code: string, 
        memoryLimitMb: number, 
        timeLimitMs: number
    ): Promise<{ stdout: string, stderr: string }> {
        
        const submissionDir = path.join(__dirname, '..', 'worker', 'temp', submissionId);
        
        const config: Record<string, { file: string, image: string, getCmd: () => string }> = {
            javascript: { file: 'index.js', image: 'node:18-alpine', getCmd: () => `node index.js` },
            python: { file: 'solution.py', image: 'python:3.10-alpine', getCmd: () => `python solution.py` },
            java: { file: 'Main.java', image: 'eclipse-temurin:17-alpine', getCmd: () => `javac Main.java && java Main` },
            cpp: { file: 'main.cpp', image: 'gcc:12', getCmd: () => `g++ main.cpp -o main && ./main` }
        };

        const langKey = language.toLowerCase() as SupportedLanguage;
        const langConfig = config[langKey];
        if (!langConfig) throw new Error(`Unsupported language: ${language}`);

        const filePath = path.join(submissionDir, langConfig.file);
        await fs.mkdir(submissionDir, { recursive: true });
        await fs.writeFile(filePath, code);

        const safeTimeLimitMs = Math.floor(Number(timeLimitMs));
        if (!Number.isFinite(safeTimeLimitMs) || safeTimeLimitMs <= 0) {
            throw new Error(`Invalid time limit: ${timeLimitMs}`);
        }

        const runCommand = langConfig.getCmd();

        // 1. Try to acquire a warm container from the pool
        const containerId = ContainerPoolService.getContainer(langKey);

        try {
            if (containerId) {
                // --- WARM START EXECUTION ---
                // --- WARM START EXECUTION ---
                // Setup directory and copy code into the running container
                await execFileAsync('docker', ['exec', containerId, 'mkdir', '-p', '/usr/src/app']);
                await execFileAsync('docker', ['cp', filePath, `${containerId}:/usr/src/app/${langConfig.file}`]);
                
                const dockerArgs = [
                    'exec',
                    '-w',
                    '/usr/src/app',
                    containerId,
                    '/bin/sh',
                    '-c',
                    runCommand
                ];

                const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
                    timeout: safeTimeLimitMs,
                    windowsHide: true
                });
                return { stdout, stderr };

            } else {
                // --- COLD START FALLBACK ---
                const safeMemoryLimitMb = Math.floor(Number(memoryLimitMb));
                if (!Number.isFinite(safeMemoryLimitMb) || safeMemoryLimitMb <= 0) {
                    throw new Error(`Invalid memory limit: ${memoryLimitMb}`);
                }

                const dockerArgs = [
                    'run',
                    '--rm',
                    `--memory=${safeMemoryLimitMb}m`,
                    '--cpus=1',
                    '--pids-limit=64',
                    '--cap-drop=ALL',
                    '--security-opt=no-new-privileges',
                    '--network',
                    'none',
                    '-v',
                    `${submissionDir}:/usr/src/app`, 
                    '-w',
                    '/usr/src/app',
                    langConfig.image,
                    '/bin/sh',
                    '-c',
                    runCommand
                ];

                const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
                    timeout: safeTimeLimitMs,
                    windowsHide: true
                });
                return { stdout, stderr };
            }

        } catch (error: any) {
            console.error("Docker execution error:", error.message, error.stderr, error.code, error.killed, error);
            if (error.killed) throw new Error("Time Limit Exceeded");
            throw new Error(error.stderr || error.message);
        } finally {
            // Cleanup local temp files
            await fs.rm(submissionDir, { recursive: true, force: true }).catch(() => {});
            
            // Trigger container destruction and replacement
            if (containerId) {
                ContainerPoolService.replaceContainer(containerId, langKey);
            }
        }
    }
};
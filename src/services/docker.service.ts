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
    ): Promise<{ stdout: string, stderr: string, executionTimeMs: number, memoryUsedKb: number }> {
        
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

                const startTime = Date.now();
                const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
                    timeout: safeTimeLimitMs,
                    windowsHide: true
                });
                const executionTimeMs = Date.now() - startTime;

                // Capture peak memory usage from the warm container
                let memoryUsedKb = 0;
                try {
                    const statsResult = await execFileAsync('docker', [
                        'stats', '--no-stream', '--format', '{{.MemUsage}}', containerId
                    ], { timeout: 5000 });
                    memoryUsedKb = this.parseMemoryUsage(statsResult.stdout);
                } catch {
                    // Stats may fail if container is already stopped; default to 0
                }

                return { stdout, stderr, executionTimeMs, memoryUsedKb };

            } else {
                // --- COLD START FALLBACK ---
                const safeMemoryLimitMb = Math.floor(Number(memoryLimitMb));
                if (!Number.isFinite(safeMemoryLimitMb) || safeMemoryLimitMb <= 0) {
                    throw new Error(`Invalid memory limit: ${memoryLimitMb}`);
                }

                // Use --name so we can query stats before --rm cleans up
                const containerName = `sub-${submissionId}-${Date.now()}`;
                const dockerArgs = [
                    'run',
                    '--name', containerName,
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

                const startTime = Date.now();
                const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
                    timeout: safeTimeLimitMs,
                    windowsHide: true
                });
                const executionTimeMs = Date.now() - startTime;

                // Capture peak memory from container inspect (works after container stops)
                let memoryUsedKb = 0;
                try {
                    const inspectResult = await execFileAsync('docker', [
                        'inspect', '--format', '{{.HostConfig.Memory}}', containerName
                    ], { timeout: 5000 });
                    // Try docker stats first for a running container, fallback to 0
                    const statsResult = await execFileAsync('docker', [
                        'stats', '--no-stream', '--format', '{{.MemUsage}}', containerName
                    ], { timeout: 5000 }).catch(() => null);
                    if (statsResult) {
                        memoryUsedKb = this.parseMemoryUsage(statsResult.stdout);
                    }
                } catch {
                    // Container already removed; default to 0
                }

                // Clean up the named container
                await execFileAsync('docker', ['rm', '-f', containerName]).catch(() => {});

                return { stdout, stderr, executionTimeMs, memoryUsedKb };
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
    },

    /**
     * Parses Docker stats memory usage string (e.g., "12.5MiB / 256MiB") into KB.
     */
    parseMemoryUsage(statsOutput: string): number {
        const match = String(statsOutput || '').trim().match(/^([\d.]+)\s*(B|KiB|MiB|GiB|kB|MB|GB)/i);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'b': return Math.round(value / 1024);
            case 'kib': case 'kb': return Math.round(value);
            case 'mib': case 'mb': return Math.round(value * 1024);
            case 'gib': case 'gb': return Math.round(value * 1024 * 1024);
            default: return 0;
        }
    }
};
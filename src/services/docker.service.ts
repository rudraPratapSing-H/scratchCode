import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

export const DockerService = {
    /**
     * Spins up an isolated Docker container to execute the provided code string.
     */
    async executeContainer(
        submissionId: string, 
        language: string, 
        code: string, 
        memoryLimitMb: number, 
        timeLimitMs: number
    ): Promise<{ stdout: string, stderr: string }> {
        
        // 1. Create a unique directory for THIS specific submission
        const submissionDir = path.join(__dirname, '..', 'worker', 'temp', submissionId);
        
        // 2. Define strict filenames required by compilers
        const config: Record<string, { file: string, image: string, getCmd: () => string }> = {
            javascript: { file: 'index.js', image: 'node:18-alpine', getCmd: () => `node index.js` },
            python: { file: 'solution.py', image: 'python:3.10-alpine', getCmd: () => `python solution.py` },
            java: { file: 'Main.java', image: 'eclipse-temurin:17-alpine', getCmd: () => `javac Main.java && java Main` },
            cpp: { file: 'main.cpp', image: 'gcc:12', getCmd: () => `g++ main.cpp -o main && ./main` }
        };

        const langConfig = config[language.toLowerCase()];
        if (!langConfig) throw new Error(`Unsupported language: ${language}`);

        const filePath = path.join(submissionDir, langConfig.file);

        // 3. Create the isolated folder and write the properly named file
        await fs.mkdir(submissionDir, { recursive: true });
        await fs.writeFile(filePath, code);

        try {
            const runCommand = langConfig.getCmd();

            const safeMemoryLimitMb = Math.floor(Number(memoryLimitMb));
            const safeTimeLimitMs = Math.floor(Number(timeLimitMs));

            if (!Number.isFinite(safeMemoryLimitMb) || safeMemoryLimitMb <= 0) {
                throw new Error(`Invalid memory limit: ${memoryLimitMb}`);
            }

            if (!Number.isFinite(safeTimeLimitMs) || safeTimeLimitMs <= 0) {
                throw new Error(`Invalid time limit: ${timeLimitMs}`);
            }
            
            const dockerArgs = [
                'run',
                '--rm',
                `--memory=${safeMemoryLimitMb}m`,
                '--cpus=0.5',
                '--network',
                'none',
                '-v',
                `${submissionDir}:/usr/src/app`, // Mount ONLY this isolated folder
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

        } catch (error: any) {
            console.error("Docker execution error:", error.message, error.stderr, error.code, error.killed, error);
            if (error.killed) throw new Error("Time Limit Exceeded");
            throw new Error(error.stderr || error.message);
        } finally {
            // 4. The Ultimate Janitor
            // Safely delete the isolated directory, removing source files, compiled binaries, and .class files at once.
            await fs.rm(submissionDir, { recursive: true, force: true }).catch(() => {});
        }
    }
};
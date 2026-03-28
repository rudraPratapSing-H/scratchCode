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
        
        const tempDir = path.join(__dirname, '..', 'worker', 'temp');
        
        const config: Record<string, { ext: string, image: string, getCmd: (file: string, noExt: string) => string }> = {
            javascript: { ext: 'js', image: 'node:18-alpine', getCmd: (file) => `node ${file}` },
            python: { ext: 'py', image: 'python:3.10-alpine', getCmd: (file) => `python ${file}` },
            java: { ext: 'java', image: 'eclipse-temurin:17-alpine', getCmd: (file) => `java ${file}` },
            cpp: { ext: 'cpp', image: 'gcc:12', getCmd: (file, noExt) => `g++ ${file} -o ${noExt} && ./${noExt}` }
        };

        const langConfig = config[language.toLowerCase()];
        if (!langConfig) throw new Error(`Unsupported language: ${language}`);

        const fileNameNoExt = submissionId; 
        const fileName = `${fileNameNoExt}.${langConfig.ext}`;
        const filePath = path.join(tempDir, fileName);

        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(filePath, code);

        try {
            const runCommand = langConfig.getCmd(fileName, fileNameNoExt);

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
                `${tempDir}:/usr/src/app`,
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
            console.error("Docker execution error:", error.message || error.stderr);
            if (error.killed) throw new Error("Time Limit Exceeded");
            throw new Error(error.stderr || error.message);
        } finally {
            // The Janitor
            await fs.unlink(filePath).catch(() => {});
            if (language.toLowerCase() === 'cpp') {
                await fs.unlink(path.join(tempDir, fileNameNoExt)).catch(() => {});
            }
        }
    }
};
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getSystemCapacity } from '../utils/system.ts';

const execFileAsync = promisify(execFile);

export const SUPPORTED_LANGUAGES = ['javascript', 'python', 'java', 'cpp'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const IMAGE_MAP: Record<SupportedLanguage, string> = {
    javascript: 'node:18-alpine',
    python: 'python:3.10-alpine',
    java: 'eclipse-temurin:17-alpine',
    cpp: 'gcc:12'
};

class ContainerPoolManager {
    // Queues of ready container IDs for each language
    private pools: Record<string, string[]> = {
        javascript: [],
        python: [],
        java: [],
        cpp: []
    };

    // Number of warm containers to keep ready per language
    private readonly CAPACITY_PER_LANGUAGE = Math.max(1, Math.floor(getSystemCapacity().optimalConcurrency / SUPPORTED_LANGUAGES.length));

    // Use a high default memory limit for the warm pool (e.g. 512MB)
    private readonly POOL_MEMORY_LIMIT_MB = 512;

    async initializePools() {
        console.log(`[ContainerPool] Initializing warm container pools... (Capacity per language: ${this.CAPACITY_PER_LANGUAGE})`);
        const initPromises: Promise<void>[] = [];

        for (const lang of SUPPORTED_LANGUAGES) {
            for (let i = 0; i < this.CAPACITY_PER_LANGUAGE; i++) {
                initPromises.push(this.spawnContainer(lang));
            }
        }

        await Promise.all(initPromises);
        console.log('[ContainerPool] Warm pools initialized.');
    }

    private async spawnContainer(language: SupportedLanguage) {
        const image = IMAGE_MAP[language];
        if (!image) return;

        // Command to keep the container running indefinitely
        const keepAliveCmd = 'tail -f /dev/null';

        const dockerArgs = [
            'run',
            '-d', // detached mode
            '--rm', // clean up when killed
            `--memory=${this.POOL_MEMORY_LIMIT_MB}m`,
            '--cpus=0.5',
            '--pids-limit=64',
            '--cap-drop=ALL',
            '--security-opt=no-new-privileges',
            '--network',
            'none',
            image,
            '/bin/sh',
            '-c',
            keepAliveCmd
        ];

        try {
            const { stdout } = await execFileAsync('docker', dockerArgs);
            const containerId = stdout.trim();
            
            // Add the new container to the pool
            if (this.pools[language]) {
                this.pools[language].push(containerId);
                console.log(`[ContainerPool] Spawned new ${language} container: ${containerId.substring(0, 12)}`);
            }
        } catch (error) {
            console.error(`[ContainerPool] Failed to spawn container for ${language}:`, error);
        }
    }

    /**
     * Gets a pre-warmed container ID. 
     * If none are available, returns null (fallback to cold start).
     */
    getContainer(language: string): string | null {
        const pool = this.pools[language];
        if (!pool || pool.length === 0) {
            return null;
        }
        // Pop a container from the queue
        return pool.shift() || null;
    }

    /**
     * Kills the used container and asynchronously spawns a replacement.
     */
    replaceContainer(containerId: string, language: SupportedLanguage) {
        // Asynchronously kill the container. We don't await this so it doesn't block.
        execFileAsync('docker', ['rm', '-f', containerId]).catch(err => {
            console.error(`[ContainerPool] Failed to remove container ${containerId}:`, err);
        });

        // Asynchronously spawn a replacement to keep the pool full
        this.spawnContainer(language).catch(() => {});
    }
}

export const ContainerPoolService = new ContainerPoolManager();

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DockerService } from '../../services/docker.service.ts';
import { ContainerPoolService } from '../../services/container-pool.service.ts';

// ---------------------------------------------------------------------------
// Mock child_process for unit tests
// ---------------------------------------------------------------------------
const mockExecFile = jest.fn();
jest.unstable_mockModule('child_process', () => ({
    execFile: mockExecFile,
}));

// We need to re-import dynamically after mocking
let DynamicDockerService: typeof DockerService;
let DynamicContainerPoolService: typeof ContainerPoolService;

beforeEach(async () => {
    jest.clearAllMocks();
    mockExecFile.mockImplementation((...args: any[]) => {
        const callback = args.pop();
        const cmd = args[0];
        const cmdArgs = args[1];

        // If it's the warm pool getting a container
        if (cmd === 'docker' && cmdArgs && cmdArgs[0] === 'run' && cmdArgs[cmdArgs.length - 1] === 'tail -f /dev/null') {
            callback(null, { stdout: 'warm-container-123\n', stderr: '' });
            return;
        }
        callback(null, { stdout: 'success output\n', stderr: '' });
    });

    const modDocker = await import('../../services/docker.service.ts');
    DynamicDockerService = modDocker.DockerService;

    const modPool = await import('../../services/container-pool.service.ts');
    DynamicContainerPoolService = modPool.ContainerPoolService;
    
    // Clear pool internally just in case
    // (A bit hacky since it's private, but it ensures clean state)
    (DynamicContainerPoolService as any).pools = {
        javascript: [], python: [], java: [], cpp: []
    };
});

describe('Sandbox Security Config (Unit)', () => {
    
    describe('Cold Start Security Flags', () => {
        it('should pass all 7 security flags to docker run', async () => {
            const code = 'console.log("hello")';
            await DynamicDockerService.executeContainer('sub-cold', 'javascript', code, 128, 2000);

            // Find the execFile call that actually runs the code (not the rm/mkdir/cp calls)
            const runCall = mockExecFile.mock.calls.find(
                (call: any) => call[0] === 'docker' && call[1][0] === 'run'
            );

            expect(runCall).toBeDefined();
            const args = runCall[1];

            expect(args).toContain('--network');
            expect(args[args.indexOf('--network') + 1]).toBe('none'); // Network isolation
            
            expect(args).toContain('--memory=128m'); // Memory limit
            expect(args).toContain('--cpus=1'); // CPU limit
            expect(args).toContain('--pids-limit=64'); // Process/fork limit
            expect(args).toContain('--cap-drop=ALL'); // Privilege drop
            expect(args).toContain('--security-opt=no-new-privileges'); // Prevent privilege escalation
            expect(args).toContain('--read-only'); // Read only filesystem
            expect(args).toContain('--rm'); // Auto-cleanup
        });
    });

    describe('Warm Pool Security Flags', () => {
        it('should spawn pool containers with all security flags', async () => {
            await DynamicContainerPoolService.initializePools();

            // Find the execFile call for spawning a pool container (e.g., javascript)
            const spawnCall = mockExecFile.mock.calls.find(
                (call: any) => call[0] === 'docker' && call[1][0] === 'run' && call[1].includes('node:18-alpine')
            );

            expect(spawnCall).toBeDefined();
            const args = spawnCall[1];

            expect(args).toContain('--network');
            expect(args[args.indexOf('--network') + 1]).toBe('none');
            
            expect(args).toContain('--memory=256m'); 
            expect(args).toContain('--cpus=1');
            expect(args).toContain('--pids-limit=64');
            expect(args).toContain('--cap-drop=ALL');
            expect(args).toContain('--security-opt=no-new-privileges');
            expect(args).toContain('--read-only');
            expect(args).toContain('--rm');
            expect(args).toContain('-d'); // detached
        });
    });

    describe('Error Handling and Limits', () => {
        it('should map killed processes to Time Limit Exceeded', async () => {
            mockExecFile.mockImplementation((...args: any[]) => {
                const callback = args.pop();
                const err = new Error('Command failed');
                (err as any).killed = true;
                callback(err, { stdout: '', stderr: '' });
            });

            await expect(DynamicDockerService.executeContainer('sub-tle', 'javascript', 'while(true){}', 128, 2000))
                .rejects.toThrow('Time Limit Exceeded');
        });

        it('should reject unsupported languages before executing', async () => {
            await expect(DynamicDockerService.executeContainer('sub-bad', 'ruby', 'puts "hi"', 128, 2000))
                .rejects.toThrow('Unsupported language: ruby');
            
            expect(mockExecFile).not.toHaveBeenCalled();
        });

        it('should reject invalid memory limits', async () => {
            await expect(DynamicDockerService.executeContainer('sub-mem', 'javascript', 'code', -100, 2000))
                .rejects.toThrow('Invalid memory limit');
            
            expect(mockExecFile).not.toHaveBeenCalled();
        });

        it('should reject invalid time limits', async () => {
            await expect(DynamicDockerService.executeContainer('sub-time', 'javascript', 'code', 128, 0))
                .rejects.toThrow('Invalid time limit');
            
            expect(mockExecFile).not.toHaveBeenCalled();
        });
    });
});

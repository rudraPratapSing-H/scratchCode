import { exec } from 'child_process';

export const executeContainer = (baseDockerCmd: string, dirPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        
        // Inject the actual directory path into the command
        const finalDockerCmd = baseDockerCmd.replace("{DIR_PATH}", dirPath);

        // Run it with a 5-second timeout and 10MB buffer limit
        exec(finalDockerCmd, { timeout: 5000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            
            if (error) {
                // Intercept the timeout error to give a clean "TLE" message
                if (error.message.includes('maxBuffer')) {
                    return reject(new Error("Output Limit Exceeded"));
                }
                if (error.killed) {
                    return reject(new Error("Time Limit Exceeded"));
                }
                // Reject with compilation/syntax errors
                return reject(new Error(stderr || error.message));
            }
            
            // If successful, resolve the Promise with the terminal output
            resolve(stdout);
        });
    });
};
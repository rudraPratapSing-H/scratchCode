import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
// Step back one folder since this file is inside /utils, but we want /temp_executions in the root
const __dirname = join(dirname(__filename), '..', '..'); 

/**
 * Creates a unique temporary directory for a code execution job.
 * @returns An object containing the executionId and the absolute directory path.
 */
export const createTempFolder = async (): Promise<{ executionId: string, dirPath: string }> => {
    const executionId = uuidv4();
    const dirPath = join(__dirname, 'temp_executions', executionId);
    
    // recursive: true ensures the parent 'temp_executions' folder is created if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });
    
    return { executionId, dirPath };
};

/**
 * Saves a string of code to a specific file inside the workspace.
 */
export const saveFile = async (dirPath: string, filename: string, content: string): Promise<string> => {
    const filePath = join(dirPath, filename);
    await fs.writeFile(filePath, content);
    return filePath;
};

/**
 * Forcibly removes the temporary directory and all files inside it.
 */
export const deleteFolder = async (dirPath: string): Promise<void> => {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
        console.error(`Failed to delete workspace at ${dirPath}:`, error);
    }
};
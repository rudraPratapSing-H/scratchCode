import os from 'os';

export const getSystemCapacity = () => {
    const cpuCores = os.cpus().length;
    const totalMemoryMB = os.totalmem() / (1024 * 1024);
    
    // Assume each container takes ~512MB, plus ~500MB reserved for the Node app/OS
    const maxContainersByRam = Math.floor((totalMemoryMB - 500) / 512);
    
    // Take the lower bottleneck (either CPU or RAM)
    const optimalConcurrency = Math.max(1, Math.min(cpuCores, maxContainersByRam));
    
    return {
        cpuCores,
        totalMemoryMB,
        maxContainersByRam,
        optimalConcurrency
    };
};

import os from 'os';

const cpuCores = os.cpus().length;
const totalMemoryMB = os.totalmem() / (1024 * 1024);

// Assume each container takes ~512MB, plus ~500MB reserved for the Node app/OS
const maxContainersByRam = Math.floor((totalMemoryMB - 500) / 512);

// Take the lower bottleneck (either CPU or RAM)
const optimalConcurrency = Math.max(1, Math.min(cpuCores, maxContainersByRam));

console.log("CPU Cores:", cpuCores);
console.log("Total Memory (MB):", totalMemoryMB.toFixed(2));
console.log("Max Containers (RAM):", maxContainersByRam);
console.log("Suggested Optimal Concurrency:", optimalConcurrency);


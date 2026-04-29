// AutocompleteTrie.ts
import { TrieNode } from './TrieNode.util';


export class AutocompleteTrie {
  root: TrieNode;

  constructor() {
    this.root = new TrieNode();
  }

  // 1. Insert problem titles into the Trie
  insert(title: string, problemId: string): void {
    let current = this.root;
    const normalizedTitle = title.toLowerCase();

    for (const char of normalizedTitle) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    
    current.isEndOfWord = true;
    current.problemId = problemId;
  }

  // 2. Fetch suggestions based on typed prefix
  getSuggestions(prefix: string, limit: number = 5): { title: string, id: string }[] {
    let current = this.root;
    const normalizedPrefix = prefix.toLowerCase();

    // Step A: Traverse down the tree to the end of the prefix
    for (const char of normalizedPrefix) {
      if (!current.children.has(char)) {
        return []; // The prefix doesn't exist in our problem list
      }
      current = current.children.get(char)!;
    }

    // Step B: Run Depth-First Search (DFS) from this node to find all completions
    const results: { title: string, id: string }[] = [];
    this.dfs(current, normalizedPrefix, results, limit);
    
    return results;
  }

  // Helper method to gather all valid words from a specific node
  private dfs(
    node: TrieNode, 
    currentString: string, 
    results: { title: string, id: string }[], 
    limit: number
  ): void {
    // Stop searching if we've hit our suggestion limit
    if (results.length >= limit) return;

    // If this node marks the end of a valid problem title, add it to results
    if (node.isEndOfWord && node.problemId) {
      results.push({ title: currentString, id: node.problemId });
    }

    // Recursively visit all children
    for (const [char, childNode] of node.children.entries()) {
      this.dfs(childNode, currentString + char, results, limit);
    }
  }
}
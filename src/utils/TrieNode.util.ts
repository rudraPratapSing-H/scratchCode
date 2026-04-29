// TrieNode.ts
export class TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  problemId?: string;

  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
  }
}
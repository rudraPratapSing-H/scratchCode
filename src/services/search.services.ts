// searchService.ts
import { AutocompleteTrie } from '../utils/AutocompleteTrie.util';
import { prisma } from '../lib/prisma'; // Adjust the path if needed

const searchTrie = new AutocompleteTrie();

async function populateTrieFromDB() {
  const problems = await prisma.problem.findMany({
    select: { id: true, title: true }
  });
  problems.forEach(p => searchTrie.insert(p.title, p.id));
}

// Call this function at startup or when you need to refresh the trie
populateTrieFromDB();

// When a user types "Two"
const suggestions = searchTrie.getSuggestions("Two"); 
console.log(suggestions);

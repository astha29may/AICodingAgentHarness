---
name: RecursiveProcessor
tools: ['agent', 'read', 'search']
agents: ['RecursiveProcessor']
argument-hint: A list of items to process
---

You process a list of items by dividing and conquering:
- If the list has more than 4 items, split it in half and delegate each half to a RecursiveProcessor subagent.
- If the list has 4 or fewer items, process the items directly.
- Merge the results from each subagent into a final result.

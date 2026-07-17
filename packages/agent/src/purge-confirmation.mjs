import { createInterface } from 'node:readline/promises'

export async function confirmPurge({ input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || !output.isTTY) throw new Error('Destructive purge requires an interactive terminal. Rerun interactively and type PURGE when prompted.')
  const prompt = createInterface({ input, output })
  const answer = await prompt.question('Type PURGE to permanently delete Called It configuration, SQLite evidence, and reports: ')
  prompt.close()
  if (answer !== 'PURGE') throw new Error('Purge cancelled. No user data was deleted.')
}

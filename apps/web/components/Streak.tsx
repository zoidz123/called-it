// The latest calls as lettered squares, oldest first: a green W went their way, a red L did not.
export function Streak({ results }: { results: boolean[] }) {
  if (!results.length) return <span className="muted">-</span>
  const wins = results.filter(Boolean).length
  return (
    <span className="streak" role="img" aria-label={`${wins} of the last ${results.length} calls went their way`}>
      {results.map((won, index) => <i key={`${index}-${won}`} className={won ? 'won' : 'lost'}>{won ? 'W' : 'L'}</i>)}
    </span>
  )
}

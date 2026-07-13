// Sim names render inside containers with an `uppercase` CSS transform.
// Plain uppercase would flatten iRacing's stylized wordmark ("iRacing" -> "IRACING",
// losing the lowercase "i"), so force the "i" lowercase and the rest uppercase
// ("iRACING") wherever the sim name is displayed — keep this consistent
// everywhere rather than letting some spots fall back to a plain "IRACING".
export function GameLabel({ game }: { game: string }) {
  if (game === 'iRacing') {
    return (
      <>
        <span className="lowercase">i</span>
        <span className="uppercase">Racing</span>
      </>
    );
  }
  return <>{game}</>;
}

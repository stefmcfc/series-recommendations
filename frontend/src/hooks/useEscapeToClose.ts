// FRONTEND-083-AC-01/AC-02: returns a keydown handler that calls `onEscape`
// when the pressed key is 'Escape' and ignores every other key -- shared by
// every hand-rolled Escape-to-close dialog handler in this app.
export function useEscapeToClose(onEscape: () => void) {
  return (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onEscape()
    }
  }
}

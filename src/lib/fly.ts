// Moves a copy of a queue chip across the screen, so a pick visibly travels
// from the list in the sheet to its dot in the city (and new dots travel back).

const EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)';

/** Send a ghost of `from` to the screen point `to`, shrinking into it. */
export function flyTo(from: HTMLElement, to: { x: number; y: number }): void {
  const rect = from.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.classList.add('chip-ghost');
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  document.body.appendChild(ghost);
  const dx = to.x - (rect.left + rect.width / 2);
  const dy = to.y - (rect.top + rect.height / 2);
  ghost
    .animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.2 },
      ],
      { duration: 460, easing: EASE },
    )
    .finished.finally(() => ghost.remove());
}

/** Make `el` arrive at its own place from the screen point `from`. */
export function flyFrom(el: HTMLElement, from: { x: number; y: number }, delay = 0): void {
  const rect = el.getBoundingClientRect();
  const dx = from.x - (rect.left + rect.width / 2);
  const dy = from.y - (rect.top + rect.height / 2);
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ],
    { duration: 520, delay, easing: EASE, fill: 'backwards' },
  );
}

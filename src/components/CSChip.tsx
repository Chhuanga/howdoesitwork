/** A CS term. Tapping it opens a one-line definition under the row of chips. */
export default function CSChip({
  term,
  open,
  onToggle,
}: {
  term: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="chip" aria-expanded={open} onClick={onToggle}>
      {term}
    </button>
  );
}

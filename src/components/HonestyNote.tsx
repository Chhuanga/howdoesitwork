export default function HonestyNote({ note }: { note: string }) {
  return (
    <p className="text-xs text-slate-500 border-l-2 border-slate-700 pl-3 leading-relaxed">
      <span className="text-slate-400 font-semibold">Real world: </span>
      {note}
    </p>
  );
}

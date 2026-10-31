import './BuildingIllustration.css';

function Building({ modifier, heightPct, rows, cols, roof }) {
  const cells = Array.from({ length: rows * cols });
  return (
    <div className={`ib-building ib-${modifier}`} style={{ height: `${heightPct}%` }}>
      {roof && <div className="ib-roof" />}
      <div className="ib-windows" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cells.map((_, i) => (
          <span key={i} className={`ib-window${i % 3 === 0 ? ' lit' : ''}`} />
        ))}
      </div>
    </div>
  );
}

export default function BuildingIllustration() {
  return (
    <div className="ib-scene" aria-hidden="true">
      <div className="ib-glow" />
      <div className="ib-skyline">
        <Building modifier="b1" heightPct={44} rows={4} cols={2} />
        <Building modifier="b2" heightPct={66} rows={6} cols={3} roof />
        <Building modifier="b3" heightPct={52} rows={5} cols={2} />
        <Building modifier="b4" heightPct={82} rows={8} cols={3} />
        <Building modifier="b5" heightPct={36} rows={3} cols={2} />
      </div>
      <div className="ib-ground" />
    </div>
  );
}

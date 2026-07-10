// Skelett vid sidbyte – gör navigering upplevt snabb
export default function Loading() {
  return (
    <>
      <div className="skel" style={{ height: 26, width: 220, marginBottom: 10 }} />
      <div className="skel" style={{ height: 14, width: 320, marginBottom: 20 }} />
      <div className="cards">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 84 }} />)}
      </div>
      <div className="list">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 64 }} />)}
      </div>
    </>
  );
}

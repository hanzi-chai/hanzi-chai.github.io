const FontView = ({ reference }: { reference: string }) => (
  <svg
    id="fontsvg"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 1000 1000"
  >
    <path d={reference} transform="matrix(1,0,0,-1,0,850)" />
  </svg>
);

const processPath = ({ start, curveList }: Stroke) =>
  "M" +
  start.join(" ") +
  curveList
    .map(({ command, parameterList }) => command + parameterList.join(" "))
    .join("");

const StrokesView = ({ glyph }: { glyph: Stroke[] }) => (
  <svg
    id="datasvg"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="100%"
    viewBox="0 0 100 100"
  >
    {glyph.map((stroke, index) => (
      <path
        key={index}
        d={processPath(stroke)}
        stroke="red"
        strokeWidth="1"
        fill="none"
      />
    ))}
  </svg>
);

export default function ComponentView({ component }: { component: Component }) {
  return (
    <div id="view">
      <h2>查看 SVG</h2>
      { component ? <div id="overlay">
        <FontView reference={component.shape[0].reference} />
        <StrokesView glyph={component.shape[0].glyph} />
      </div> : <div id="overlay" />}
    </div>
  );
}

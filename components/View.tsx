import React from 'react';
import useSWR from 'swr';

export const useComponent = (char: string) => useSWR(`/data?char=${char}`, async (key) => (await fetch(key).then(res => res.json())) as Character);

const View = ({ char }: { char: string }) => {
  const framework = <div id="view"><h2>查看 SVG</h2><div id="overlay"></div></div>;
  const { data, error } = useComponent(char);
  if (data?.shape === undefined) return framework;
  const { shape } = data;
  const { glyph, reference } = shape[0];
  const processPath = ({ start, curveList }: Stroke) => 'M' + start.join(' ') + curveList.map(({ command, parameterList }) => command + parameterList.join(' ')).join('');

  return (
    <div id="view">
      <h2>查看 SVG</h2>
      <div id="overlay">
        <svg id="fontsvg" xmlns="http://www.w3.org/2000/svg" version="1.1" width="100%" viewBox="0 0 1000 1000">
          <path d={reference} transform="matrix(1,0,0,-1,0,850)" />
        </svg>
        <svg id="datasvg" xmlns="http://www.w3.org/2000/svg" version="1.1" width="100%" viewBox="0 0 100 100">
          {
            glyph.map((stroke, index) => <path key={index} d={processPath(stroke)} stroke="red" strokeWidth="1" fill="none" />)
          }
        </svg>
      </div>
    </div>
  );
}

export default View;

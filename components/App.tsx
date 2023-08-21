import React, { PropsWithChildren } from 'react';
import { StrokeModel, Change } from '../components/Model';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import CHAI from '../data/CHAI.json';

const List = ({ setCurrentComponent, children }: PropsWithChildren<{setCurrentComponent: (s: string) => void}>) => <div id="list">
  <h2>选择汉字</h2>
  <select id="selector" size={20} onChange={(event) => setCurrentComponent(event.target.value)}>
    { children }
  </select>
</div>

const Model = ({ children }: PropsWithChildren) => <div id="model">
  <h2>调整数据</h2>
  { children }
</div>

const View = ({ children }: PropsWithChildren) => <div id="view">
  <h2>查看 SVG</h2>
  <div id="overlay">
    { children }
  </div>
</div>

const FontView = ({ reference }: { reference: string }) => <svg id="fontsvg" xmlns="http://www.w3.org/2000/svg" version="1.1" width="100%" viewBox="0 0 1000 1000">
  <path d={reference} transform="matrix(1,0,0,-1,0,850)" />
</svg>

const processPath = ({ start, curveList }: Stroke) => 'M' + start.join(' ') + curveList.map(({ command, parameterList }) => command + parameterList.join(' ')).join('');

const DataView = ({ glyph }: { glyph: Stroke[]}) => <svg id="datasvg" xmlns="http://www.w3.org/2000/svg" version="1.1" width="100%" viewBox="0 0 100 100">
  {
    glyph.map((stroke, index) => <path key={index} d={processPath(stroke)} stroke="red" strokeWidth="1" fill="none" />)
  }
</svg>

export default function App() {
  const [currentComponent, setCurrentComponent] = useState('');
  const components = Object.keys(CHAI);
  const component = CHAI[currentComponent as '一'];

  return (
    <>
      <div>
        <h1>笔画数据校对</h1>
      </div>
      <List setCurrentComponent={setCurrentComponent}>
        {
          [...components].sort((x, y) => {
            if (x.length < y.length) return -1;
            if (x.length > y.length) return 1;
            if (x < y) return -1;
            if (x > y) return 1;
            return 0;
          }).map(component => <option key={component} value={component}>{component}</option>)
        }
      </List>
      <View>
        { component?.shape && <>
          <FontView reference={component.shape[0].reference} />
          <DataView glyph={component.shape[0].glyph} />
        </>}
      </View>
      <Model>
        { component?.shape && <Change.Provider value={async (strokeIndex: number, curveIndex: number, parameterIndex: number, value: number) => {
          const modified = JSON.parse(JSON.stringify(component.shape[0].glyph));
          if (curveIndex === -1) {
            modified[strokeIndex].start[parameterIndex] = value;
          } else {
            modified[strokeIndex].curveList[curveIndex].parameterList[parameterIndex] = value;
          }
          const newData = { shape: [{ ...component.shape[0], glyph: modified }] };
          // await fetch(`/data`, {
          //   headers: { 'Content-Type': 'application/json' },
          //   method: 'PUT',
          //   body: JSON.stringify({ key: currentComponent, value: newData })
          // });
          // await mutate(newData);
        }}>
          {
            component.shape[0].glyph.map((stroke, strokeIndex) => <StrokeModel key={strokeIndex} stroke={stroke} strokeIndex={strokeIndex} />)
          }
        </Change.Provider>
        }
      </Model>
    </>
  );
}

import List from '../components/List';
import View from '../components/View';
import Model from '../components/Model';
import { useState } from 'react';
import useSWR from 'swr';

export default function App() {
  const { data, error } = useSWR('/data', async (key) => (await fetch(key).then(res => res.json())) as string[]);

  const [currentComponent, setCurrentComponent] = useState('');
  if (error) return <h1>Cannot fetch data!</h1>
  if (!data) return <h1>Loading...</h1>;

  return (
    <>
      <div>
        <h1>笔画数据校对</h1>
      </div>
      <List components={data} select={setCurrentComponent} />
      <View char={currentComponent} />
      <Model char={currentComponent} />
    </>
  );
}

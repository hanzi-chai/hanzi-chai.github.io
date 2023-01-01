import React from 'react';

interface ListProps {
  components: string[],
  select: (s: string) => void
}

let List = ({ components, select }: ListProps) => {
  const array = [...components];
  array.sort((x, y) => {
    if (x.length < y.length) return -1;
    if (x.length > y.length) return 1;
    if (x < y) return -1;
    if (x > y) return 1;
    return 0;
  });
  return (
    <div id="list">
      <h2>选择汉字</h2>
      <select id="selector" size={20} onChange={(event) => select(event.target.value)}>
        {
          array && array.map(component => {
            return <option key={component} value={component}>{component}</option>
          })
        }
      </select>
    </div>
  )
}

export default List;
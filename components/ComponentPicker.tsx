export default function ComponentPicker({
  setCurrentComponent,
  components,
}: {
  setCurrentComponent: (s: string) => void;
  components: string[];
}) {
  return (
    <div id="list">
      <h2>选择汉字</h2>
      <select
        id="selector"
        size={20}
        onChange={(event) => setCurrentComponent(event.target.value)}
      >
        {[...components]
          .sort((x, y) => {
            if (x.length < y.length) return -1;
            if (x.length > y.length) return 1;
            if (x < y) return -1;
            if (x > y) return 1;
            return 0;
          })
          .map((component) => (
            <option key={component} value={component}>
              {component}
            </option>
          ))}
      </select>
    </div>
  );
}

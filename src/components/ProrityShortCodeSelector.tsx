import {
  useAtomValue,
  优先简码原子,
  最大码长原子,
  优先简码映射原子,
  useAtom,
} from "~/atoms";
import { Select } from "~/components/Utils";
import { 识别符 } from "~/lib";

export default function PriorityShortCodeSelector({
  词,
  拼音来源列表,
}: {
  词: string;
  拼音来源列表: string[][];
}) {
  const max_length = useAtomValue(最大码长原子);
  const [priorityShortCodes, setPriorityShortCodes] = useAtom(优先简码原子);
  const 优先简码映射 = useAtomValue(优先简码映射原子);
  const hash = 识别符(词, 拼音来源列表);
  const level = 优先简码映射.get(hash) ?? -1;
  return (
    <Select
      size="small"
      value={level}
      options={[-1, ...Array(max_length + 1).keys()].map((x) => {
        return { label: x === -1 ? "默认" : x.toString(), value: x };
      })}
      onChange={(value) => {
        if (value === -1) {
          const updated = priorityShortCodes.filter((x) => {
            const entry_hash = 识别符(x.词, x.拼音来源列表);
            return entry_hash !== hash;
          });
          setPriorityShortCodes(updated);
        } else {
          if (优先简码映射.has(hash)) {
            const updated = priorityShortCodes.map((x) => {
              const entry_hash = 识别符(x.词, x.拼音来源列表);
              if (entry_hash === hash) {
                return { ...x, 级别: value };
              }
              return x;
            });
            setPriorityShortCodes(updated);
          } else {
            // Need to add new entry
            const n = { 词, 拼音来源列表, 级别: value };
            setPriorityShortCodes([...priorityShortCodes, n]);
          }
        }
      }}
    />
  );
}

import { Suspense } from "react";
import {
  useAtomValue,
  优先简码原子,
  最大码长原子,
  优先简码映射原子,
  useAtom,
  useAtomValueUnwrapped,
  如编码结果原子,
} from "~/atoms";
import { Select } from "~/components/Utils";
import { type 优先简码, 识别符 } from "~/lib";

export function 编码渲染({
  index,
  type,
}: {
  index: number;
  type: "全码" | "简码";
}) {
  const [编码结果] = useAtomValueUnwrapped(如编码结果原子);
  const { 全码, 全码排名, 简码, 简码排名 } = 编码结果[index]!;
  const code = type === "全码" ? 全码 : 简码;
  const rank = type === "全码" ? Math.abs(全码排名) : Math.abs(简码排名);
  return (
    <Suspense fallback={<span>加载中...</span>}>
      <span style={{ color: rank > 0 ? "red" : undefined }}>
        {code}
        {rank > 0 ? `[${rank}]` : ""}
      </span>
    </Suspense>
  );
}

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
            const entry_hash = 识别符(x.word, x.sources);
            return entry_hash !== hash;
          });
          setPriorityShortCodes(updated);
        } else {
          if (优先简码映射.has(hash)) {
            const updated = priorityShortCodes.map((x) => {
              const entry_hash = 识别符(x.word, x.sources);
              if (entry_hash === hash) {
                return { ...x, level: value };
              }
              return x;
            });
            setPriorityShortCodes(updated);
          } else {
            // Need to add new entry
            const n: 优先简码 = {
              word: 词,
              sources: 拼音来源列表,
              level: value,
            };
            setPriorityShortCodes([...priorityShortCodes, n]);
          }
        }
      }}
    />
  );
}

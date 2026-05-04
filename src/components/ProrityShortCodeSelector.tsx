import { type 优先简码, type 字符, 识别符 } from "hanzi-chai";
import {
  useAtom,
  useAtomValue,
  优先简码原子,
  优先简码映射原子,
  原始字库原子,
  最大码长原子,
} from "~/atoms";
import { Select } from "~/components/Utils";

interface 校验优先简码 extends Omit<优先简码, "word"> {
  word: 字符[];
}

export default function PriorityShortCodeSelector({
  词,
  拼音来源列表,
}: {
  词: 字符[];
  拼音来源列表: string[][];
}) {
  const max_length = useAtomValue(最大码长原子);
  const [priorityShortCodes, setPriorityShortCodes] = useAtom(优先简码原子);
  const 优先简码映射 = useAtomValue(优先简码映射原子);
  const hash = 识别符(词, 拼音来源列表);
  const level = 优先简码映射.get(hash) ?? -1;
  const 原始字库 = useAtomValue(原始字库原子);

  const 校验优先简码: 校验优先简码[] = [];
  for (const entry of priorityShortCodes) {
    const chars: 字符[] = [];
    let valid = true;
    for (const c of entry.word) {
      const ch = 原始字库.校验(c);
      if (ch) {
        chars.push(ch.character);
      } else {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    校验优先简码.push({ ...entry, word: chars });
  }

  return (
    <Select
      size="small"
      value={level}
      options={[-1, ...Array(max_length + 1).keys()].map((x) => {
        return { label: x === -1 ? "默认" : x.toString(), value: x };
      })}
      onChange={(value) => {
        if (value === -1) {
          const updated = 校验优先简码.filter((x) => {
            const entry_hash = 识别符(x.word, x.sources);
            return entry_hash !== hash;
          });
          setPriorityShortCodes(
            updated.map((x) => ({
              word: x.word.map((c) => c.toString()).join(""),
              sources: x.sources,
              level: x.level,
            })),
          );
        } else {
          if (优先简码映射.has(hash)) {
            const updated = 校验优先简码.map((x) => {
              const entry_hash = 识别符(x.word, x.sources);
              if (entry_hash === hash) {
                return { ...x, level: value };
              }
              return x;
            });
            setPriorityShortCodes(
              updated.map((x) => ({
                word: x.word.map((c) => c.toString()).join(""),
                sources: x.sources,
                level: x.level,
              })),
            );
          } else {
            // Need to add new entry
            const n: 优先简码 = {
              word: 词.map((c) => c.toString()).join(""),
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

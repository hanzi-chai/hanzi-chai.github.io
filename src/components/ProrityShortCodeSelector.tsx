import {
  useAtomValue,
  useAtom,
  priorityShortCodesAtom,
  maxLengthAtom,
} from "~/atoms";
import { Select } from "~/components/Utils";
import { getPriorityMap } from "~/lib";

export default function PriorityShortCodeSelector({ hash }: { hash: string }) {
  const max_length = useAtomValue(maxLengthAtom);
  const [priorityShortCodes, setPriorityShortCodes] = useAtom(
    priorityShortCodesAtom,
  );
  const priorityMap = getPriorityMap(priorityShortCodes);
  const level = priorityMap.get(hash);
  return (
    <Select
      size="small"
      value={level ?? -1}
      options={[-1, ...Array(max_length + 1).keys()].map((x) => {
        return { label: x === -1 ? "默认" : x.toString(), value: x };
      })}
      onChange={(value) => {
        if (value === -1) {
          priorityMap.delete(hash);
        } else {
          priorityMap.set(hash, value);
        }
        setPriorityShortCodes(
          [...priorityMap.entries()].map(([hash, level]) => {
            const [word, pinyin_list] = hash.split("-");
            return [word, pinyin_list, level] as [string, string, number];
          }),
        );
      }}
    />
  );
}

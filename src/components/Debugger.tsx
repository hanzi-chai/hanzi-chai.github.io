import {
  Button,
  Flex,
  Form,
  Radio,
  Space,
  Statistic,
  Switch,
  Table,
  Typography,
  notification,
} from "antd";
import { Select, Uploader } from "~/components/Utils";

export default function Debugger() {
  const referenceAtom = useMemo(
    () =>
      atomWithStorage<Record<string, string[]>>(
        "reference_" + config.info.name,
        {},
      ),
    [config.info?.name],
  );

  const [reference, setReference] = useAtom(referenceAtom);
  const [debug, setDebug] = useState(false);
  const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  type FilterOption = (typeof filterOptions)[number];
  const supplemental = getSupplemental(repertoire, list);
  const filterMap: Record<FilterOption, (p: string) => boolean> = {
    成字部件: (char) => repertoire[char]?.glyph?.type === "basic_component",
    非成字部件: (char) => supplemental.includes(char),
    所有汉字: () => true,
  };
  const filterFn = filterMap[filterOption];

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;
  if (debug && dataSource && mode === "character") {
    dataSource = dataSource.filter(({ item, full }) => {
      if (!filterFn(item)) return false;
      const codes = reference[item];
      if (codes === undefined) {
        unknown += 1;
        return false;
      } else if (!codes.includes(full)) {
        incorrect += 1;
        return true;
      } else {
        correct += 1;
        return false;
      }
    });
  }

  return (
    <>
      <Flex justify="center" align="center" gap="middle">
        校对模式
        <Switch checked={debug} onChange={setDebug} />
        <Uploader
          type="txt"
          text="导入 TSV 码表"
          action={(content) => {
            const ref: Record<string, string[]> = {};
            const tsv = content
              .trim()
              .split("\n")
              .map((x) => x.split("\t"));
            for (const line of tsv) {
              const [key, value] = line;
              if (key !== undefined && value !== undefined) {
                ref[key] = [value];
              }
            }
            setReference(ref);
          }}
        />
        {reference !== undefined &&
          `已加载码表，条数：${Object.keys(reference).length}`}
      </Flex>
      {debug && (
        <Flex
          justify="space-between"
          align="center"
          style={{ alignSelf: "stretch" }}
        >
          <Form.Item label="校对范围" style={{ margin: 0 }}>
            <Select
              style={{ width: 128 }}
              value={filterOption}
              options={filterOptions.map((x) => ({ label: x, value: x }))}
              onChange={setFilterOption}
            />
          </Form.Item>
          <Flex>
            <Statistic style={{ width: 80 }} title="正确" value={correct} />
            <Statistic style={{ width: 80 }} title="错误" value={incorrect} />
            <Statistic style={{ width: 80 }} title="未知" value={unknown} />
            <Statistic
              style={{ width: 80 }}
              title="准确率"
              value={
                Math.round((correct / (correct + incorrect + unknown)) * 100) +
                "%"
              }
            />
          </Flex>
        </Flex>
      )}
    </>
  );
}

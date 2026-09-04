import { Checkbox, Flex, Form, Space, Tooltip } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import Table from "antd/es/table";
import { 区块列表, 图形盒子, type 扩展字符数据, 是用户字符 } from "hanzi-chai";
import { atomWithStorage } from "jotai/utils";
import { useMemo, useState } from "react";
import { createCharacter, removeCharacter, updateCharacter } from "~/api";
import {
  useAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  下一个用户字符码位原子,
  可编辑字符列表原子,
  如按笔顺排序字符原子,
  字库原子,
  字形来源列表原子,
  字形自定义原子,
  用户字符列表原子,
  远程原子,
} from "~/atoms";
import { errorFeedback, 字符字形过滤器, type 过滤器参数 } from "~/utils";
import BorderItem from "./BorderItem";
import CharacterForm from "./CharacterForm";
import CharacterGlyphSwitcher from "./CharacterGlyphSwitcher";
import FilterForm from "./FilterForm";
import GlyphRecommendation from "./GlyphRecommendation";
import { EditOrRedrawGraph } from "./GlyphTable";
import GlyphView from "./GlyphView";
import PatchForm from "./PatchForm";
import SourceSelect from "./SourceSelect";
import { BoxedElementWithTooltip, DeleteButton } from "./Utils";

const CreateCharacter = () => {
  const 远程 = useAtomValue(远程原子);
  const [用户字符列表, set用户字符列表] = useAtom(用户字符列表原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const 下一个用户字符码位 = useAtomValue(下一个用户字符码位原子);
  return (
    <CharacterForm
      title="新建"
      initialValues={{ unicode: 0, glyphs: [] }}
      onFinish={async (record) => {
        if (远程) {
          const res = await createCharacter(record);
          if (!errorFeedback(res)) {
            set可编辑字符列表([...可编辑字符列表, record]);
          }
        } else {
          const recordWithUnicode = { ...record, unicode: 下一个用户字符码位 };
          set用户字符列表([...用户字符列表, recordWithUnicode]);
        }
        return true;
      }}
    />
  );
};

const DeleteCharacter = ({ unicode }: { unicode: number }) => {
  const 远程 = useAtomValue(远程原子);
  const [用户字符列表, set用户字符列表] = useAtom(用户字符列表原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  return (
    <DeleteButton
      disabled={!远程 && !是用户字符(unicode)}
      onClick={async () => {
        if (!confirm(`确定删除字符 ${unicode} 吗？`)) return;
        if (远程) {
          const res = await removeCharacter(unicode);
          if (!errorFeedback(res)) {
            set可编辑字符列表(
              可编辑字符列表.filter((x) => x.unicode !== unicode),
            );
          }
        } else {
          set用户字符列表(用户字符列表.filter((x) => x.unicode !== unicode));
        }
      }}
    />
  );
};

const EditOrPatchCharacter = ({ character }: { character: 扩展字符数据 }) => {
  const 远程 = useAtomValue(远程原子);
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const [用户字符列表, set用户字符列表] = useAtom(用户字符列表原子);

  return 远程 || character.character.是用户私用区() ? (
    <CharacterForm
      title="编辑"
      initialValues={character}
      onFinish={async (values) => {
        if (远程) {
          const res = await updateCharacter(values);
          if (!errorFeedback(res)) {
            set可编辑字符列表(
              可编辑字符列表.map((x) =>
                x.unicode === values.unicode ? values : x,
              ),
            );
          }
        } else {
          set用户字符列表(
            用户字符列表.map((x) =>
              x.unicode === values.unicode ? values : x,
            ),
          );
        }
        return true;
      }}
    />
  ) : (
    <PatchForm character={character.character} />
  );
};

type Column = ColumnType<扩展字符数据>;

export default function CharacterTable() {
  const 远程 = useAtomValue(远程原子);
  const 字库 = useAtomValue(字库原子);
  const 按笔顺排序字符 = useAtomValueUnwrapped(如按笔顺排序字符原子);
  const [字形来源列表, 设置字形来源列表] = useAtom(字形来源列表原子);
  const 字形自定义 = useAtomValue(字形自定义原子);
  const [filter, setFilter] = useState({} as 过滤器参数);
  const dataSource = useMemo(() => {
    const 过滤器 = new 字符字形过滤器(filter);
    const result: 扩展字符数据[] = [];
    for (const character of 按笔顺排序字符) {
      const data = 字库.查询字符(character);
      if (!data) continue;
      if (!过滤器.过滤字符(data.character, data, 字库)) continue;
      result.push(data);
    }
    return result;
  }, [按笔顺排序字符, 字库, filter]);
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);

  const unicodeColumn: Column = {
    title: "Unicode",
    dataIndex: "unicode",
    render: (_, { character }) => {
      return (
        <Flex align="center" gap="small">
          <BoxedElementWithTooltip element={character} />
          {character.十六进制()}
        </Flex>
      );
    },
    filters: 区块列表.map((x) => ({ text: x.label, value: x.name })),
    onFilter: (value, record) => {
      return record.character.区块() === value;
    },
    sorter: (a, b) => a.unicode - b.unicode,
    sortDirections: ["ascend", "descend"],
    width: 128,
    sortOrder: "ascend",
  };

  const tygfColumn: Column = {
    title: "通用规范",
    dataIndex: "tygf",
    width: 96,
    render: (_, record) => {
      return <Checkbox checked={record.tygf !== undefined} />;
    },
    filters: [
      { text: "一级", value: 1 },
      { text: "二级", value: 2 },
      { text: "三级", value: 3 },
      { text: "否", value: 0 },
    ],
    onFilter: (value, record) => value === record.tygf,
  };

  const gb2312: Column = {
    title: "GB 2312",
    dataIndex: "gb2312",
    render: (_, record) => {
      return <Checkbox checked={record.gb2312 !== undefined} />;
    },
    width: 96,
    filters: [
      { text: "一级", value: 1 },
      { text: "二级", value: 2 },
      { text: "否", value: 0 },
    ],
    onFilter: (value, record) => value === record.gb2312,
  };

  const glyphs: Column = {
    title: "字形列表",
    dataIndex: "glyphs",
    render: (_, character) => {
      return (
        <span>
          {character.final_glyphs.map(({ id, sources }) => (
            <span key={id}>
              <Tooltip title={id}>
                <EditOrRedrawGraph
                  id={id}
                  trigger={
                    <BorderItem>
                      <GlyphView glyph={字库.获取字形(id)!.图形盒子} />
                    </BorderItem>
                  }
                  initialChar={character.character.获取名称()}
                />
              </Tooltip>
              <sub className="px-1">{sources.join("")}</sub>
            </span>
          ))}
        </span>
      );
    },
    sorter: (a, b) => {
      const [as, bs] = [JSON.stringify(a.glyphs), JSON.stringify(b.glyphs)];
      return as.localeCompare(bs);
    },
    sortDirections: ["ascend", "descend"],
  };

  const patches: Column = {
    title: "补丁列表",
    render: (_, record) => {
      const 字符串 = record.character.获取名称();
      const 补丁列表 = 字形自定义[字符串] ?? [];
      const symbol = {
        delete: "−",
        insert: "+",
        update: "±",
      };
      return (
        <span>
          {补丁列表.map((patch, index) => (
            <span key={index}>
              {symbol[patch.type]} ({patch.sources.join(", ")}){" "}
              {patch.type === "delete" ? null : (
                <GlyphView
                  glyph={字库.获取字形(patch.id)?.图形盒子 ?? new 图形盒子()}
                />
              )}
            </span>
          ))}
        </span>
      );
    },
    width: 128,
  };

  const operations: Column = {
    title: "操作",
    key: "option",
    render: (_, record) => (
      <Space>
        <EditOrPatchCharacter character={record} />
        {远程 && <GlyphRecommendation character={record} />}
        <DeleteCharacter unicode={record.unicode} />
      </Space>
    ),
    filters: [
      { text: "已编辑", value: 1 },
      { text: "未编辑", value: 0 },
    ],
    onFilter: (value, record) => {
      const customized =
        record.character.是用户私用区() ||
        (字形自定义[record.character.获取名称()]?.length ?? 0) > 0;
      return value === 1 ? customized : !customized;
    },
  };

  const columns: ColumnsType<扩展字符数据> = [
    unicodeColumn,
    tygfColumn,
    gb2312,
    glyphs,
    patches,
    operations,
  ];

  if (远程) {
    columns.splice(4, 1); // remove patches column
  }

  return (
    <Flex className="overflow-y-scroll" vertical align="center" gap="small">
      <FilterForm setFilter={setFilter} />
      <Flex gap="large">
        <CharacterGlyphSwitcher />
        {!远程 && (
          <Form.Item label="选择字形来源" className="m-0!">
            <SourceSelect value={字形来源列表} onChange={设置字形来源列表} />
          </Form.Item>
        )}
        <CreateCharacter />
      </Flex>
      <Table<扩展字符数据>
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="unicode"
        pagination={{ defaultPageSize: 50, current: currentPage, onChange: (page) => setCurrentPage(page) }}
        className="max-w-480"
      />
    </Flex>
  );
}

const currentPageAtom = atomWithStorage("character-table-current-page", 367);

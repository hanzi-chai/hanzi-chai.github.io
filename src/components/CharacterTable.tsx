import React, { useContext, useState } from "react";
import { isPUA, unicodeBlock } from "~/lib/utils";
import { Checkbox, Flex, Layout, Space } from "antd";
import type { ColumnType, ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import {
  allRepertoireAtom,
  customGlyphAtom,
  displayAtom,
  repertoireAtom,
  sequenceAtom,
  useAddAtom,
  useAtomValue,
  userRepertoireAtom,
  userTagsAtom,
} from "~/atoms";
import type { PrimitveCharacter } from "~/lib/data";
import {
  Add,
  Create,
  Delete,
  Mutate,
  QuickPatchAmbiguous,
  RemoteContext,
} from "~/components/Action";
import StrokeSearch, { makeFilter } from "~/components/CharacterSearch";
import ComponentForm from "./ComponentForm";
import CompoundForm from "./CompoundForm";
import { remoteUpdate } from "~/lib/api";
import { DeleteButton, PlusButton, errorFeedback } from "./Utils";
import Root from "./Element";
import * as O from "optics-ts/standalone";
import CharacterQuery, {
  CharacterFilter,
  makeCharacterFilter,
} from "./CharacterQuery";
import TagPicker from "./TagPicker";

type Column = ColumnType<PrimitveCharacter>;

const CharacterTable = () => {
  const allRepertoire = useAtomValue(allRepertoireAtom);
  const userRepertoire = useAtomValue(userRepertoireAtom);
  const addUser = useAddAtom(userRepertoireAtom);
  const userTags = useAtomValue(userTagsAtom);
  const customGlyph = useAtomValue(customGlyphAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  const [page, setPage] = useState(1);
  const [filterProps, setFilterProps] = useState<CharacterFilter>({});
  const display = useAtomValue(displayAtom);
  const getLength = (a: string) => sequenceMap.get(a)?.length ?? Infinity;
  const remote = useContext(RemoteContext);
  const add = useAddAtom(repertoireAtom);
  const filter = makeCharacterFilter(filterProps, allRepertoire, sequenceMap);
  const isUserPUA = (a: string) =>
    -Number(a.codePointAt(0)! >= 0xf000 && a.codePointAt(0)! <= 0x10000);

  const dataSource = Object.entries(allRepertoire)
    .sort(([a], [b]) => getLength(a) - getLength(b))
    .sort(([a], [b]) => isUserPUA(a) - isUserPUA(b))
    .filter(([x]) => filter(x))
    .map(([, glyph]) => glyph);

  const unicodeColumn: Column = {
    title: "Unicode",
    dataIndex: "unicode",
    render: (_, { unicode, name }) => {
      const char = String.fromCodePoint(unicode);
      const hex = unicode.toString(16).toUpperCase();
      return (isPUA(char) ? name : char) + ` (${hex})`;
    },
    filters: [
      { text: "CJK 基本集", value: "cjk" },
      { text: "CJK 扩展集 A", value: "cjk-a" },
      { text: "非成字", value: "pua" },
    ],
    onFilter: (value, record) => {
      return unicodeBlock(record.unicode) === value;
    },
    sorter: (a, b) => a.unicode - b.unicode,
    sortDirections: ["ascend", "descend"],
    width: 128,
  };

  const tygfColumn: Column = {
    title: "通用规范",
    dataIndex: "tygf",
    width: 96,
    render: (_, record) => {
      return <Checkbox checked={record.tygf === 1} />;
    },
    filters: [
      { text: "是", value: 1 },
      { text: "否", value: 0 },
    ],
    onFilter: (value, record) => value === record.tygf,
  };

  const gb2312: Column = {
    title: "GB 2312",
    dataIndex: "gb2312",
    render: (_, record) => {
      return <Checkbox checked={record.gb2312} />;
    },
    width: 96,
    filters: [
      { text: "是", value: true },
      { text: "否", value: false },
    ],
    onFilter: (value, record) => value === record.gb2312,
  };

  const readings: Column = {
    title: "系统字音",
    dataIndex: "readings",
    render: (_, record) => {
      return (
        <Space>
          {record.readings.map((reading, index) => (
            <Root key={index}>{reading}</Root>
          ))}
        </Space>
      );
    },
    width: 128,
  };

  const gf0014: Column = {
    title: "GF0014",
    dataIndex: "gf0014_id",
    width: 128,
    filters: [{ text: "只看非空", value: 1 }],
    onFilter: (_, record) => record.gf0014_id !== null,
    sorter: (a, b) => Number(a.gf0014_id) - Number(b.gf0014_id),
  };

  const glyphs: Column = {
    title: "系统字形",
    render: (_, character) => {
      const { glyphs, unicode } = character;
      const char = String.fromCodePoint(unicode);
      const inlineUpdate = async (newCharacter: PrimitveCharacter) => {
        if (userRepertoire[char] !== undefined) {
          addUser(char, newCharacter);
          return true;
        }
        console.log(newCharacter);
        const res = await remoteUpdate(newCharacter);
        if (!errorFeedback(res)) {
          add(char, newCharacter);
        }
        return true;
      };
      return (
        <Flex gap="small">
          {glyphs.map((x, i) => {
            const lens = O.compose("glyphs", O.at(i));
            const primary = userTags.some((tag) => x.tags?.includes(tag));
            return (
              <Space key={i}>
                {x.type === "compound" ? (
                  <CompoundForm
                    key={i}
                    title={`${x.operator} ${x.operandList
                      .map(display)
                      .join(" ")}`}
                    initialValues={x}
                    onFinish={(values) =>
                      inlineUpdate(O.set(lens, values, character))
                    }
                    primary={primary}
                  />
                ) : (
                  <ComponentForm
                    key={i}
                    title={`部件`}
                    initialValues={x}
                    current={String.fromCodePoint(unicode)}
                    onFinish={(values) =>
                      inlineUpdate(O.set(lens, values, character))
                    }
                    primary={primary}
                  />
                )}
                <DeleteButton
                  onClick={() => inlineUpdate(O.remove(lens, character))}
                />
              </Space>
            );
          })}
        </Flex>
      );
    },
    width: 256,
    sorter: (a, b) => {
      const [as, bs] = [JSON.stringify(a.glyphs), JSON.stringify(b.glyphs)];
      return as.localeCompare(bs);
    },
    sortDirections: ["ascend", "descend"],
  };

  const customGlyphColumn: Column = {
    title: "自定义字形",
    render: (_, character) => {
      const { glyphs, unicode } = character;
      const char = String.fromCodePoint(unicode);
      const customized = customGlyph[char];
      if (customized === undefined) return null;
      return (
        <Flex gap="small">
          {customized.type === "compound" ? (
            <CompoundForm
              title={
                customized.operator +
                customized.operandList.map(display).join(" ")
              }
              initialValues={customized}
              onFinish={async (values) => true}
            />
          ) : (
            <ComponentForm
              title={`部件`}
              initialValues={customized}
              current={String.fromCodePoint(unicode)}
              onFinish={async (values) => true}
            />
          )}
        </Flex>
      );
    },
    width: 192,
    sorter: (a, b) => {
      const [as, bs] = [JSON.stringify(a.glyphs), JSON.stringify(b.glyphs)];
      return as.localeCompare(bs);
    },
    sortDirections: ["ascend", "descend"],
  };

  const ambiguous: Column = {
    title: "分部歧义",
    dataIndex: "ambiguous",
    render: (_, record) => {
      return <QuickPatchAmbiguous checked={record.ambiguous} record={record} />;
    },
    filters: [
      { text: "只看有歧义", value: 1 },
      { text: "只看无歧义", value: 0 },
    ],
    onFilter: (value, record) => Number(record.ambiguous) === value,
    width: 96,
  };

  const operations: Column = {
    title: "操作",
    key: "option",
    render: (_, record) => (
      <Space>
        <Add character={record} />
        <Mutate unicode={record.unicode} />
        <Delete unicode={record.unicode} />
      </Space>
    ),
    filters: [
      { text: "已编辑", value: 1 },
      { text: "未编辑", value: 0 },
    ],
    onFilter: (value, record) => {
      const char = String.fromCodePoint(record.unicode);
      const customized = userRepertoire[char] !== undefined;
      return value === 1 ? customized : !customized;
    },
  };

  const adminColumns = [
    unicodeColumn,
    readings,
    glyphs,
    gf0014,
    ambiguous,
    operations,
  ];
  const userColumns = [
    unicodeColumn,
    readings,
    glyphs,
    customGlyphColumn,
    operations,
  ];
  const columns: ColumnsType<PrimitveCharacter> = remote
    ? adminColumns
    : userColumns;
  return (
    <Flex
      component={Layout.Content}
      style={{ padding: "32px", overflowY: "scroll" }}
      vertical
      gap="large"
      align="center"
    >
      <CharacterQuery setFilter={setFilterProps} />
      <TagPicker />
      <Create onCreate={(char) => {}} />
      <Table<PrimitveCharacter>
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="unicode"
        pagination={{
          pageSize: 50,
          current: page,
        }}
        onChange={(pagination) => {
          const current = pagination.current;
          current && setPage(current);
        }}
        style={{
          maxWidth: "1920px",
        }}
      />
    </Flex>
  );
};

export default CharacterTable;

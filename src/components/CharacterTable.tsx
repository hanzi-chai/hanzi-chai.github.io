import { useContext, useRef, useState } from "react";
import { Checkbox, Flex, FloatButton, Layout, Space, Tour } from "antd";
import type { ColumnType, ColumnsType } from "antd/es/table";
import Table from "antd/es/table";
import {
  字形自定义原子,
  如确定字库原子,
  原始字库数据原子,
  如字库原子,
  如笔顺映射原子,
  如排序字库数据原子,
  useAddAtom,
  useAtomValue,
  用户原始字库数据原子,
  useAtomValueUnwrapped,
} from "~/atoms";
import {
  EditGlyph,
  Create,
  Delete,
  Merge,
  QuickPatchAmbiguous,
  EditGF,
  Rename,
} from "~/components/Action";
import ComponentForm, { IdentityForm } from "./ComponentForm";
import CompoundForm from "./CompoundForm";
import { remoteUpdate } from "~/api";
import { DeleteButton, Display } from "./Utils";
import * as O from "optics-ts/standalone";
import CharacterQuery from "./CharacterQuery";
import type { TourProps } from "antd/lib";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { ElementWithTooltip } from "./ElementPool";
import TransformersForm from "./Transformers";
import type { 原始汉字数据 } from "~/lib";
import {
  type 字符过滤器参数,
  errorFeedback,
  RemoteContext,
  字符过滤器,
} from "~/utils";
import { 区块列表, 是私用区, 查询区块 } from "~/lib";

type Column = ColumnType<原始汉字数据>;

const typenames = {
  basic_component: "基本部件",
  derived_component: "衍生部件",
  spliced_component: "拼接部件",
  identity: "全等",
};

export const InlineUpdater = ({ character }: { character: 原始汉字数据 }) => {
  const { glyphs, unicode } = character;
  const char = String.fromCodePoint(unicode);
  const remote = useContext(RemoteContext);
  const userRepertoire = useAtomValue(用户原始字库数据原子);
  const addUser = useAddAtom(用户原始字库数据原子);
  const add = useAddAtom(原始字库数据原子 as any);
  const inlineUpdate = async (newCharacter: 原始汉字数据) => {
    if (userRepertoire[char] !== undefined) {
      addUser(char, newCharacter);
      return true;
    }
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
        const primary = i === 0;
        const title =
          x.type === "compound" ? (
            <Space>
              <span>{x.operator}</span>
              {x.operandList.map((y, i) => (
                <Display key={i} name={y} />
              ))}
            </Space>
          ) : (
            typenames[x.type]
          );
        return (
          <Flex key={i}>
            {x.type === "compound" || x.type === "spliced_component" ? (
              <CompoundForm
                key={i}
                title={title}
                initialValues={x}
                onFinish={(values) => {
                  const newGlyphs = O.set(
                    O.compose("glyphs", O.appendTo),
                    values,
                    O.remove(lens, character),
                  );
                  return inlineUpdate(newGlyphs);
                }}
                primary={primary}
                readonly={!remote && userRepertoire[char] === undefined}
              />
            ) : x.type === "basic_component" ||
              x.type === "derived_component" ? (
              <ComponentForm
                key={i}
                title={title}
                initialValues={x}
                current={String.fromCodePoint(unicode)}
                onFinish={(values) => {
                  const newGlyphs = O.set(
                    O.compose("glyphs", O.appendTo),
                    values,
                    O.remove(lens, character),
                  );
                  return inlineUpdate(newGlyphs);
                }}
                primary={primary}
                readonly={!remote && userRepertoire[char] === undefined}
              />
            ) : (
              <IdentityForm
                key={i}
                title={title}
                initialValues={x}
                current={String.fromCodePoint(unicode)}
                onFinish={(values) => {
                  const newGlyphs = O.set(
                    O.compose("glyphs", O.appendTo),
                    values,
                    O.remove(lens, character),
                  );
                  return inlineUpdate(newGlyphs);
                }}
                primary={primary}
                readonly={!remote && userRepertoire[char] === undefined}
              />
            )}
            {remote || userRepertoire[char] !== undefined ? (
              <DeleteButton
                onClick={() => inlineUpdate(O.remove(lens, character))}
              />
            ) : null}
          </Flex>
        );
      })}
    </Flex>
  );
};

export const InlineCustomizer = ({
  character,
}: {
  character: 原始汉字数据;
}) => {
  const determinedRepertoire = useAtomValueUnwrapped(如确定字库原子);
  const repertoire = useAtomValueUnwrapped(如字库原子);
  const addCustomGlyph = useAddAtom(字形自定义原子);
  const customGlyph = useAtomValue(字形自定义原子);
  const { unicode } = character;
  const char = String.fromCodePoint(unicode);
  let customized = customGlyph[char];
  let readonly = false;
  if (repertoire._get()[char] !== determinedRepertoire._get()[char]) {
    customized = repertoire._get()[char]!.glyph;
    readonly = true;
  }
  if (customized === undefined) return null;
  const title =
    customized.type === "compound" ||
    customized.type === "spliced_component" ? (
      <Space>
        <span>{customized.operator}</span>
        {customized.operandList.map((y, index) => (
          <Display key={index} name={y} />
        ))}
      </Space>
    ) : (
      typenames[customized.type]
    );
  return (
    <Flex gap="small">
      {customized.type === "compound" ||
      customized.type === "spliced_component" ? (
        <CompoundForm
          title={title}
          initialValues={customized}
          onFinish={async (values) => {
            addCustomGlyph(char, values);
            return true;
          }}
          primary
          readonly={readonly}
        />
      ) : customized.type === "basic_component" ||
        customized.type === "derived_component" ? (
        <ComponentForm
          title={title}
          initialValues={customized}
          current={String.fromCodePoint(unicode)}
          onFinish={async (values) => {
            addCustomGlyph(char, values);
            return true;
          }}
          primary
          readonly={readonly}
        />
      ) : (
        <IdentityForm
          title={title}
          initialValues={customized}
          current={String.fromCodePoint(unicode)}
          onFinish={async (values) => {
            addCustomGlyph(char, values);
            return true;
          }}
          primary
          readonly={readonly}
        />
      )}
    </Flex>
  );
};

export default function CharacterTable() {
  const primitiveRepertoire = useAtomValue(原始字库数据原子);
  const userRepertoire = useAtomValue(用户原始字库数据原子);
  const sortedRepertoire = useAtomValueUnwrapped(如排序字库数据原子);
  const customGlyph = useAtomValue(字形自定义原子);
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
  const [page, setPage] = useState(1);
  const [filterProps, setFilterProps] = useState<字符过滤器参数>({});
  const remote = useContext(RemoteContext);
  const filter = new 字符过滤器(filterProps);

  const dataSource: 原始汉字数据[] = [];
  for (const 字符 of Object.keys(sortedRepertoire)) {
    const data = userRepertoire[字符] ?? primitiveRepertoire[字符];
    if (!data) continue;
    if (filter.过滤(字符, data, sequenceMap.get(字符) ?? "")) {
      dataSource.push(data);
    }
  }

  const unicodeColumn: Column = {
    title: "Unicode",
    dataIndex: "unicode",
    render: (_, { unicode, name }) => {
      const char = String.fromCodePoint(unicode);
      const hex = unicode.toString(16).toUpperCase();
      return (
        <Flex align="center" gap="small">
          <ElementWithTooltip element={char} />
          {hex}
          {是私用区(char) && remote && <Rename unicode={unicode} name={name} />}
        </Flex>
      );
    },
    filters: 区块列表.map((x) => ({ text: x.label, value: x.name })),
    onFilter: (value, record) => {
      return 查询区块(record.unicode) === value;
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
      return <Checkbox checked={record.tygf > 0} />;
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
      return <Checkbox checked={record.gb2312 > 0} />;
    },
    width: 96,
    filters: [
      { text: "一级", value: 1 },
      { text: "二级", value: 2 },
      { text: "否", value: 0 },
    ],
    onFilter: (value, record) => value === record.gb2312,
  };

  const gf0014: Column = {
    title: "GF0014",
    dataIndex: "gf0014_id",
    render: (_, record) => (
      <EditGF
        type="gf0014_id"
        value={record.gf0014_id}
        unicode={record.unicode}
      />
    ),
    width: 96,
    filters: [{ text: "只看非空", value: 1 }],
    onFilter: (_, record) => record.gf0014_id !== null,
    sorter: (a, b) => Number(a.gf0014_id) - Number(b.gf0014_id),
  };

  const gf3001: Column = {
    title: "GF3001",
    dataIndex: "gf3001_id",
    render: (_, record) => (
      <EditGF
        type="gf3001_id"
        value={record.gf3001_id}
        unicode={record.unicode}
      />
    ),
    width: 96,
    filters: [{ text: "只看非空", value: 1 }],
    onFilter: (_, record) => record.gf3001_id !== null,
    sorter: (a, b) => Number(a.gf3001_id) - Number(b.gf3001_id),
  };

  const glyphs: Column = {
    title: "系统字形",
    render: (_, character) => <InlineUpdater character={character} />,
    sorter: (a, b) => {
      const [as, bs] = [JSON.stringify(a.glyphs), JSON.stringify(b.glyphs)];
      return as.localeCompare(bs);
    },
    sortDirections: ["ascend", "descend"],
    filters: [{ text: "部件", value: 1 }],
    onFilter: (_, record) => {
      return record.glyphs.some((x) => x.type !== "compound");
    },
  };

  const customGlyphColumn: Column = {
    title: "自定义字形",
    render: (_, character) => <InlineCustomizer character={character} />,
    width: 128,
  };

  const ambiguous: Column = {
    title: "歧义",
    dataIndex: "ambiguous",
    render: (_, record) => {
      return <QuickPatchAmbiguous checked={record.ambiguous} record={record} />;
    },
    filters: [
      { text: "只看有歧义", value: 1 },
      { text: "只看无歧义", value: 0 },
    ],
    onFilter: (value, record) => Number(record.ambiguous) === value,
    width: 64,
  };

  const operations: Column = {
    title: "操作",
    key: "option",
    render: (_, record) => (
      <Space>
        <EditGlyph character={record} />
        {remote && <Merge unicode={record.unicode} />}
        <Delete unicode={record.unicode} />
      </Space>
    ),
    filters: [
      { text: "已编辑", value: 1 },
      { text: "未编辑", value: 0 },
    ],
    onFilter: (value, record) => {
      const char = String.fromCodePoint(record.unicode);
      const customized =
        userRepertoire[char] !== undefined || customGlyph[char] !== undefined;
      return value === 1 ? customized : !customized;
    },
  };

  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);

  const [open, setOpen] = useState<boolean>(false);

  const steps: TourProps["steps"] = [
    {
      title: "自定义",
      description:
        "这里存放了汉字编码所需要的字音和字形数据。一个字可能会有零个、一个或多个字音和字形表示，默认情况下所有的字音表示都会用于生成编码，但是字形表示中只有第一个会参与编码。对于字形，如果系统中的第一个不是您想要的，您可以通过点击「自定义」来选择系统中的其他字形用于编码，或者自己创建一个部件或者复合体表示。",
      target: () => ref1.current,
    },
    {
      title: "批量自定义",
      description:
        "除此之外，您还可以在下方的「通过标签来批量选择字形」中选择一系列标签，被标签选中的系统字形会优先参与编码（例如，若您选择标签「行框」，则所有如街、衔、衡等的汉字都会选择［⿻ 行 ？］的分部方式，而不是原本排在第一位的左中右分部方式）。被选中的字形会以框选的方式突出显示。",
      target: () => ref2.current,
    },
    {
      title: "新建",
      description:
        "最后，您还可以通过点击「新建」来添加系统中没有的字或者您需要的特殊字根。新加的条目位于表格的最上方。若这个字或字根不属于 CJK 基本集或者 CJK 扩展 A，则您需要输入它的别名，系统会给它安排一个 0xF000 开头的 PUA 码位存放。",
      target: () => ref3.current,
    },
  ];

  const adminColumns = [
    unicodeColumn,
    tygfColumn,
    gb2312,
    glyphs,
    gf3001,
    gf0014,
    ambiguous,
    operations,
  ];
  const userColumns = [
    unicodeColumn,
    glyphs,
    customGlyphColumn,
    operations,
    gb2312,
    ambiguous,
  ];
  const columns: ColumnsType<原始汉字数据> = remote
    ? adminColumns
    : userColumns;
  return (
    <Flex
      component={Layout.Content}
      style={{ overflowY: "scroll" }}
      vertical
      align="center"
      gap="small"
    >
      <CharacterQuery setFilter={setFilterProps} />
      <Flex gap="large" ref={ref2}>
        <TransformersForm />
        <Create onCreate={() => {}} ref={ref3} />
      </Flex>
      <div ref={ref1}>
        <Table<原始汉字数据>
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
        <Tour open={open} onClose={() => setOpen(false)} steps={steps} />
        <FloatButton
          icon={<QuestionCircleOutlined />}
          type="primary"
          style={{ right: 64 }}
          onClick={() => setOpen(true)}
        />
      </div>
    </Flex>
  );
}

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Checkbox, Flex, FloatButton, Layout, Space, Tour } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import Table from "antd/es/table";
import type { TourProps } from "antd/lib";
import { isEqual } from "lodash-es";
import * as O from "optics-ts/standalone";
import { useRef, useState } from "react";
import { remoteUpdate } from "~/api";
import {
  useAddAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  useRemoveAtom,
  原始可编辑字库数据原子,
  原始字库原子,
  如字库原子,
  如排序字库数据原子,
  如确定字库原子,
  如笔顺映射原子,
  字形自定义原子,
  标准字形自定义原子,
  用户原始字库数据原子,
  远程原子,
} from "~/atoms";
import {
  Create,
  Delete,
  EditGF,
  EditGlyph,
  Merge,
  QuickPatchAmbiguous,
  Rename,
} from "~/components/Action";
import type { 原始汉字数据, 字形数据 } from "~/lib";
import { 区块列表, 是用户私用区, 是私用区, 查询区块 } from "~/lib";
import { errorFeedback, 字符过滤器, type 字符过滤器参数 } from "~/utils";
import CharacterQuery from "./CharacterQuery";
import ComponentForm, { IdentityForm } from "./ComponentForm";
import CompoundForm from "./CompoundForm";
import { ElementWithTooltip } from "./ElementPool";
import TransformersForm from "./Transformers";
import { DeleteButton, Display } from "./Utils";

type Column = ColumnType<原始汉字数据>;

const typenames = {
  basic_component: "基本部件",
  derived_component: "衍生部件",
  spliced_component: "拼接部件",
  compound: "复合体",
  identity: "全等",
};

export const 字形编辑器 = ({
  字,
  字形,
  回调,
  只读,
}: {
  字: string;
  字形: 字形数据;
  回调: (v: 字形数据) => Promise<boolean>;
  只读: boolean;
}) => {
  const title = typenames[字形.type];
  if (字形.type === "compound" || 字形.type === "spliced_component") {
    return (
      <CompoundForm
        title={
          <Space>
            <span>{字形.operator}</span>
            {字形.operandList.map((y, index) => (
              <Display key={index} name={y} />
            ))}
          </Space>
        }
        initialValues={字形}
        onFinish={回调}
        primary
        readonly={只读}
      />
    );
  }
  return 字形.type === "basic_component" ||
    字形.type === "derived_component" ? (
    <ComponentForm
      title={title}
      initialValues={字形}
      current={字}
      onFinish={回调}
      primary
      readonly={只读}
    />
  ) : (
    <IdentityForm
      title={title}
      initialValues={字形}
      current={字}
      onFinish={回调}
      primary
      readonly={只读}
    />
  );
};

export const 字形数据更新器 = ({ character }: { character: 原始汉字数据 }) => {
  const { glyphs, unicode } = character;
  const 字 = String.fromCodePoint(unicode);
  const 远程 = useAtomValue(远程原子);
  const 用户原始字库数据 = useAtomValue(用户原始字库数据原子);
  const 添加用户汉字 = useAddAtom(用户原始字库数据原子);
  const 添加汉字 = useAddAtom(原始可编辑字库数据原子);
  const inlineUpdate = async (newCharacter: 原始汉字数据) => {
    if (用户原始字库数据[字] !== undefined) {
      添加用户汉字(字, newCharacter);
      return true;
    }
    const res = await remoteUpdate(newCharacter);
    if (!errorFeedback(res)) {
      添加汉字(字, newCharacter);
    }
    return true;
  };
  const 只读 = !远程 && 用户原始字库数据[字] === undefined;
  return (
    <Flex gap="small">
      {glyphs.map((x, i) => {
        const lens = O.compose("glyphs", O.at(i));
        const 回调 = (values: 字形数据) => {
          const newGlyphs = O.set(
            O.compose("glyphs", O.appendTo),
            values,
            O.remove(lens, character),
          );
          return inlineUpdate(newGlyphs);
        };
        return (
          <Flex key={i}>
            <字形编辑器 字={字} 字形={x} 回调={回调} 只读={只读} />
            {远程 || 用户原始字库数据[字] !== undefined ? (
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

export const 字形数据自定义器 = ({
  character,
}: {
  character: 原始汉字数据;
}) => {
  const 确定字库 = useAtomValueUnwrapped(如确定字库原子);
  const 字库 = useAtomValueUnwrapped(如字库原子);
  const 添加自定义字形 = useAddAtom(字形自定义原子);
  const 删除自定义字形 = useRemoveAtom(字形自定义原子);
  const 标准字形自定义 = useAtomValue(标准字形自定义原子);
  const 字 = String.fromCodePoint(character.unicode);
  let 自定义字形列表 = 标准字形自定义[字];
  let 只读 = false;
  // 把变换生成的也视为自定义
  if (!isEqual(字库._get()[字], 确定字库._get()[字])) {
    自定义字形列表 = 字库._get()[字]!.glyphs;
    只读 = true;
  }
  if (自定义字形列表 === undefined) return null;
  return (
    <Flex gap="small">
      {自定义字形列表.map((x, i) => {
        const 回调 = async (values: 字形数据) => {
          const 新列表 = 自定义字形列表.map((item, index) =>
            index === i ? values : item,
          );
          添加自定义字形(字, 新列表);
          return true;
        };
        return (
          <Flex key={i}>
            <字形编辑器 字={字} 字形={x} 回调={回调} 只读={只读} />
            <DeleteButton
              onClick={() => {
                const 新列表 = 自定义字形列表.filter((_, index) => index !== i);
                if (新列表.length === 0) {
                  删除自定义字形(字);
                } else {
                  添加自定义字形(字, 新列表);
                }
              }}
            />
          </Flex>
        );
      })}
    </Flex>
  );
};

export default function CharacterTable() {
  const 原始字库 = useAtomValue(原始字库原子);
  const 排序字库数据 = useAtomValueUnwrapped(如排序字库数据原子);
  const 字形自定义 = useAtomValue(标准字形自定义原子);
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const [filterProps, setFilterProps] = useState<字符过滤器参数>({});
  const remote = useAtomValue(远程原子);
  const filter = new 字符过滤器(filterProps);

  const dataSource: 原始汉字数据[] = [];
  for (const 字符 of Object.keys(排序字库数据)) {
    const data = 原始字库.查询(字符);
    if (!data) continue;
    if (filter.过滤(字符, data, 笔顺映射.get(字符) ?? "")) {
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
    render: (_, character) => <字形数据更新器 character={character} />,
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
    render: (_, character) => <字形数据自定义器 character={character} />,
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
      const customized = 是用户私用区(char) || 字形自定义[char] !== undefined;
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

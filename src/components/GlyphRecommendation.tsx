import type { ProFormInstance } from "@ant-design/pro-components";
import {
  ProForm,
  ProFormDigit,
  ProFormGroup,
  ProFormList,
  ProFormText,
} from "@ant-design/pro-components";
import { Button, Flex, Input, Popconfirm } from "antd";
import type {
  基本字形数据,
  复合体数据,
  字形来源数据,
  字符数据,
} from "hanzi-chai";
import { useAtom } from "jotai";
import { isEqual, maxBy } from "lodash-es";
import type { MutableRefObject, ReactNode } from "react";
import { useRef, useState } from "react";
import { createGlyph, updateCharacter } from "~/api";
import { errorFeedback } from "~/utils";
import { 可编辑字形列表原子, 可编辑字符列表原子 } from "../atoms";
import GlyphSelect from "./GlyphSelect";
import SourceSelect from "./SourceSelect";

const InlineRender = ({
  listDom,
  action,
}: {
  listDom: ReactNode;
  action: ReactNode;
}) => (
  <div className="inline-flex mr-2">
    {listDom}
    {action}
  </div>
);

type 推荐结果 = {
  sources: string[];
  id: number;
  references: { id: number }[];
}[];

const GlyphRecommendationForm = ({
  formRef,
}: {
  formRef: MutableRefObject<ProFormInstance | undefined>;
}) => {
  return (
    <ProForm submitter={false} formRef={formRef} layout="horizontal">
      <ProFormList
        name="result"
        alwaysShowItemLabel
        creatorRecord={() => ({
          sources: [],
          id: 0,
          references: [{ id: 1 }, { id: 1 }],
        })}
      >
        <ProFormGroup>
          <ProForm.Item label="来源" name="sources">
            <SourceSelect />
          </ProForm.Item>
          <ProForm.Item label="字形ID" name="id">
            <GlyphSelect />
          </ProForm.Item>
          <ProFormList
            name="references"
            creatorButtonProps={false}
            itemRender={InlineRender}
          >
            <ProForm.Item label="引用" name="id">
              <GlyphSelect />
            </ProForm.Item>
          </ProFormList>
        </ProFormGroup>
      </ProFormList>
    </ProForm>
  );
};

export const BatchGlyphRecommendation = () => {
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const [from, setFrom] = useState<number>(0);
  const [to, setTo] = useState<number>(0);

  return (
    <Popconfirm
      title={`推断其他来源字形`}
      description={
        <Flex>
          <Input
            value={from.toString(16)}
            onChange={(e) => setFrom(parseInt(e.target.value, 16))}
          />
          <Input
            value={to.toString(16)}
            onChange={(e) => setTo(parseInt(e.target.value, 16))}
          />
        </Flex>
      }
      onConfirm={async () => {
        const 新可编辑字形列表 = [...可编辑字形列表];
        const 字符替换表 = new Map<number, 字符数据>();
        for (let unicode = from; unicode <= to; unicode++) {
          const character = 可编辑字符列表.find((c) => c.unicode === unicode);
          if (!character) continue;
          const 推荐结果 = 计算字形推荐(
            character,
            可编辑字符列表,
            可编辑字形列表,
          );
          if (!推荐结果) continue;
          const res = await handle(character, 推荐结果, 可编辑字形列表);
          if (!res) continue;
          const { newCharacter, 可编辑字形列表增量 } = res;
          新可编辑字形列表.push(...可编辑字形列表增量);
          字符替换表.set(unicode, newCharacter);
        }
        set可编辑字形列表(新可编辑字形列表);
        const 新可编辑字符列表 = 可编辑字符列表.map((c) =>
          字符替换表.has(c.unicode) ? 字符替换表.get(c.unicode)! : c,
        );
        set可编辑字符列表(新可编辑字符列表);
      }}
    >
      <Button>批量补全</Button>
    </Popconfirm>
  );
};

async function handle(
  character: 字符数据,
  推荐结果: 推荐结果,
  可编辑字形列表: 基本字形数据[],
) {
  const 可编辑字形列表增量: 基本字形数据[] = [];
  const newGlyphs: 字形来源数据[] = [];
  const 参考字形 = character.glyphs[0]!.id;
  const 参考字形数据 = 可编辑字形列表.find((g) => g.id === 参考字形)!;
  if (参考字形数据.type !== "compound") return;
  const { id, gf0014_id, gf3001_id, name, references, ...rest } = 参考字形数据;
  for (const { sources, id, references } of 推荐结果) {
    if (sources.length === 0) continue;
    if (id === 0) {
      const glyph: 复合体数据 = { id: 0, references, ...rest };
      const res = await createGlyph(glyph);
      if (!errorFeedback(res)) {
        const withId = { ...glyph, id: res };
        可编辑字形列表增量.push(withId);
        newGlyphs.push({ id: res, sources });
      }
    } else {
      newGlyphs.push({ id, sources });
    }
  }
  const newCharacter = {
    ...character,
    glyphs: newGlyphs,
  };
  const res = await updateCharacter(newCharacter);
  if (!errorFeedback(res)) return { newCharacter, 可编辑字形列表增量 };
}

export default function GlyphRecommendation({
  character,
}: {
  character: 字符数据;
}) {
  const [可编辑字符列表, set可编辑字符列表] = useAtom(可编辑字符列表原子);
  const [可编辑字形列表, set可编辑字形列表] = useAtom(可编辑字形列表原子);
  const formRef = useRef<ProFormInstance>(undefined);

  return (
    <Popconfirm
      title={`从来源 ${character.glyphs[0]?.sources[0]} 推断其他来源字形`}
      description={<GlyphRecommendationForm formRef={formRef} />}
      onPopupClick={() => {
        const 结果 = 计算字形推荐(character, 可编辑字符列表, 可编辑字形列表);
        formRef.current?.setFieldsValue({ result: 结果 });
      }}
      onConfirm={async () => {
        const 推荐结果: 推荐结果 = formRef.current?.getFieldValue("result");
        if (!推荐结果) return;
        const res = await handle(character, 推荐结果, 可编辑字形列表);
        if (!res) return;
        const { newCharacter, 可编辑字形列表增量 } = res;
        set可编辑字形列表([...可编辑字形列表, ...可编辑字形列表增量]);
        const 新可编辑字符列表 = 可编辑字符列表.map((c) =>
          c.unicode === character.unicode ? newCharacter : c,
        );
        set可编辑字符列表(新可编辑字符列表);
      }}
    >
      <Button>补全</Button>
    </Popconfirm>
  );
}

const visitedRanges = [
  { start: 0x4e00, end: 0x6400 },
  { start: 0x7a70, end: 0x7aca },
  { start: 0x7cf8, end: 0x7f35 },
  { start: 0x8fb6, end: 0x9090 },
];

function 计算字形推荐(
  character: 字符数据,
  可编辑字符列表: 字符数据[],
  可编辑字形列表: 基本字形数据[],
) {
  const 字形查找表 = new Map(可编辑字形列表.map((glyph) => [glyph.id, glyph]));
  const 字形哈希表 = new Map(
    可编辑字形列表.map((glyph) => {
      const { id, gf0014_id, gf3001_id, name, ...rest } = glyph;
      return [JSON.stringify(rest), glyph];
    }),
  );
  const 样本字符范围 = 可编辑字符列表.filter((c) =>
    visitedRanges.some(
      ({ start, end }) => c.unicode >= start && c.unicode <= end,
    ),
  );
  const 来源列表 = character.glyphs.flatMap((g) => g.sources);
  const 参考来源 = 来源列表[0]!;
  const 待推断来源列表 = 来源列表.slice(1);
  const 参考字形 = character.glyphs[0]!.id;
  const 参考字形数据 = 字形查找表.get(参考字形)!;
  if (参考字形数据.type === "component") return null;
  const 统计数据 = new Map<string, Map<number, number>[]>();
  for (const 来源 of 待推断来源列表) {
    统计数据.set(
      来源,
      参考字形数据.references.map(() => new Map<number, number>()),
    );
  }
  for (const [index, 引用] of 参考字形数据.references.entries()) {
    for (const 样本字符 of 样本字符范围) {
      const 样本参考字形 = 样本字符.glyphs.find((g) =>
        g.sources.includes(参考来源),
      );
      if (!样本参考字形) continue;
      const 样本参考字形数据 = 字形查找表.get(样本参考字形.id);
      if (!样本参考字形数据) continue;
      if (样本参考字形数据.type === "component") continue;
      const 样本参考引用索引 = 样本参考字形数据.references.findIndex(
        (x) => x.id === 引用.id,
      );
      if (样本参考引用索引 === -1) continue;
      for (const 待推断来源 of 待推断来源列表) {
        const 统计 = 统计数据.get(待推断来源)![index]!;
        const 样本字形 = 样本字符.glyphs.find((g) =>
          g.sources.includes(待推断来源),
        );
        if (!样本字形) continue;
        const 样本字形数据 = 字形查找表.get(样本字形.id);
        if (!样本字形数据) continue;
        if (样本字形数据.type === "component") continue;
        const 样本对应引用 = 样本字形数据.references[样本参考引用索引];
        if (!样本对应引用) continue;
        统计.set(样本对应引用.id, (统计.get(样本对应引用.id) ?? 0) + 1);
      }
    }
  }
  // 对于每个待推断来源，统计每个引用的出现次数，选择出现次数最多的引用作为推荐结果
  const 分组推荐结果: 推荐结果 = [
    {
      sources: [参考来源],
      id: 参考字形数据.id,
      references: 参考字形数据.references,
    },
  ];
  for (const [来源, 引用统计列表] of 统计数据.entries()) {
    const 字形ID列表: number[] = [];
    for (const [index, 引用统计] of 引用统计列表.entries()) {
      字形ID列表.push(
        maxBy([...引用统计], ([_, count]) => count)?.[0] ??
          参考字形数据.references[index]!.id,
      );
    }
    const 分组 = 分组推荐结果.find((g) =>
      isEqual(
        g.references.map((r) => r.id),
        字形ID列表,
      ),
    );
    if (分组) {
      分组.sources.push(来源);
    } else {
      const { id: _, name, gf0014_id, gf3001_id, ...rest } = 参考字形数据;
      const references = 字形ID列表.map((id) => ({ id }));
      const x = { ...rest, references };
      const 字形数据 = 字形哈希表.get(JSON.stringify(x));
      let id = 0;
      if (字形数据 && 字形数据.type === "compound") {
        id = 字形数据.id;
      }
      分组推荐结果.push({
        sources: [来源],
        id,
        references,
      });
    }
  }
  return 分组推荐结果;
}

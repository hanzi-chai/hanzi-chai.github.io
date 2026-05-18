import { Button, Flex, Popover } from "antd";
import {
  type 元素,
  type 基本分析,
  type 复合体,
  部件,
  type 默认部件分析,
} from "hanzi-chai";
import { useState } from "react";
import {
  useAddAtom,
  useAtomValue,
  useAtomValueUnwrapped,
  useRemoveAtom,
  全部合法元素原子,
  动态分析原子,
  动态自定义拆分原子,
  强类型自定义分析原子,
  自定义拆分原子,
} from "~/atoms";
import { 数字 } from "~/utils";
import ElementSelect from "./ElementSelect";
import {
  BoxedElementWithTooltip,
  CharacterWithTooltip,
  DeleteButton,
  PlusButton,
} from "./Utils";

const Customize = ({
  component,
  initialValues,
}: {
  component: 部件;
  initialValues: 元素[];
}) => {
  const add = useAddAtom(自定义拆分原子);
  const { 笔画列表 } = useAtomValueUnwrapped(全部合法元素原子);
  const [content, setContent] = useState<元素[]>(initialValues);
  return (
    <Flex vertical gap="small">
      <Flex gap="small" wrap="wrap">
        {content.map((x, i) => (
          <Flex key={i} align="center">
            <ElementSelect
              className="w-24"
              onlyRootsAndStrokes
              value={x}
              onChange={(v) =>
                setContent(content.map((c, j) => (j === i ? v : c)))
              }
            />
            <DeleteButton
              onClick={() => setContent(content.filter((_, j) => j !== i))}
            />
          </Flex>
        ))}
        <PlusButton onClick={() => setContent([...content, 笔画列表[0]!])} />
      </Flex>
      <Flex gap="small">
        <Button
          type="primary"
          onClick={() =>
            add(
              component.获取索引(),
              content.map((x) => x.获取名称()),
            )
          }
        >
          提交
        </Button>
      </Flex>
    </Flex>
  );
};

const DynamicCustomize = ({
  component,
  initialValues,
}: {
  component: 部件;
  initialValues: 元素[][];
}) => {
  const add = useAddAtom(动态自定义拆分原子);
  const { 笔画列表 } = useAtomValueUnwrapped(全部合法元素原子);
  const [content, setContent] = useState<元素[][]>(initialValues);
  return (
    <Flex vertical gap="small">
      {content.map((group, i) => (
        <Flex key={i} gap="small" align="center" wrap="wrap">
          {group.map((x, j) => (
            <Flex key={j} align="center">
              <ElementSelect
                className="w-24"
                onlyRootsAndStrokes
                includeOptional
                value={x}
                onChange={(v) =>
                  setContent(
                    content.map((g, gi) =>
                      gi === i ? g.map((c, ci) => (ci === j ? v : c)) : g,
                    ),
                  )
                }
              />
              <DeleteButton
                onClick={() =>
                  setContent(
                    content.map((g, gi) =>
                      gi === i ? g.filter((_, ci) => ci !== j) : g,
                    ),
                  )
                }
              />
            </Flex>
          ))}
          <PlusButton
            onClick={() =>
              setContent(
                content.map((g, gi) => (gi === i ? [...g, 笔画列表[0]!] : g)),
              )
            }
          />
          <Button
            size="small"
            onClick={() => setContent(content.filter((_, gi) => gi !== i))}
          >
            删除组
          </Button>
        </Flex>
      ))}
      <Flex gap="small">
        <Button onClick={() => setContent([...content, [笔画列表[0]!]])}>
          添加组
        </Button>
        <Button
          type="primary"
          onClick={() =>
            add(
              component.获取索引(),
              content.map((g) => g.map((x) => x.获取名称())),
            )
          }
        >
          提交
        </Button>
      </Flex>
    </Flex>
  );
};

export default function ResultSummary({
  glyph,
  analysis,
}: {
  glyph: 部件 | 复合体;
  analysis: 基本分析 | 默认部件分析;
}) {
  let 字根序列 = analysis.字根序列;
  if ("被覆盖拆分方式" in analysis && analysis.被覆盖拆分方式) {
    字根序列 = analysis.被覆盖拆分方式.拆分方式.map((x) => x.字根);
  }
  const 是否动态分析 = useAtomValue(动态分析原子);
  const { 自定义分析映射, 动态自定义分析映射 } = useAtomValueUnwrapped(
    强类型自定义分析原子,
  );
  const 移除自定义分析 = useRemoveAtom(自定义拆分原子);
  const 移除动态自定义分析 = useRemoveAtom(动态自定义拆分原子);
  const 自定义字根序列 =
    glyph instanceof 部件 ? 自定义分析映射.get(glyph) : undefined;
  const 自定义字根序列列表 =
    glyph instanceof 部件 ? 动态自定义分析映射.get(glyph) : undefined;
  return (
    <Flex gap="middle" justify="space-between">
      <Flex onClick={(e) => e.stopPropagation()} gap="small" align="center">
        <CharacterWithTooltip element={glyph.字符} />
        {glyph instanceof 部件 && glyph.字形序号 !== 0 && (
          <span>之{数字(glyph.字形序号)}</span>
        )}
        {字根序列.map((x, index) => {
          const element = x instanceof 部件 ? x.字符 : x;
          return (
            <Flex key={index} align="center">
              <BoxedElementWithTooltip element={element} />
            </Flex>
          );
        })}
        {自定义字根序列 && (
          <Flex gap="small" align="center">
            <span>（自定义：）</span>
            {自定义字根序列.map((x, i) => {
              return <BoxedElementWithTooltip key={i} element={x} />;
            })}
          </Flex>
        )}
        {自定义字根序列列表 && (
          <Flex gap="small" align="center" wrap="wrap">
            <span>（自定义组：）</span>
            {自定义字根序列列表.map((x, i) => (
              <Flex key={i} align="center">
                {x.map((y, j) => {
                  return <BoxedElementWithTooltip key={j} element={y} />;
                })}
                ・
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
      {glyph instanceof 部件 && (
        <Flex onClick={(e) => e.stopPropagation()} gap="middle">
          {自定义字根序列 && (
            <Button onClick={() => 移除自定义分析(glyph.获取索引())}>
              取消自定义
            </Button>
          )}
          {自定义字根序列列表 && (
            <Button onClick={() => 移除动态自定义分析(glyph.获取索引())}>
              取消自定义组
            </Button>
          )}
          {"全部拆分方式" in analysis && 是否动态分析 && (
            <Popover
              title="自定义动态拆分"
              trigger="click"
              content={
                <DynamicCustomize
                  component={glyph}
                  initialValues={
                    自定义字根序列列表 ??
                    analysis.全部拆分方式
                      .filter((x) => x.可用)
                      .map((x) =>
                        x.拆分方式.map((y) =>
                          y.字根 instanceof 部件 ? y.字根.字符 : y.字根,
                        ),
                      )
                  }
                />
              }
            >
              <Button>自定义组</Button>
            </Popover>
          )}
          <Popover
            title="自定义拆分"
            trigger="click"
            content={
              <Customize
                component={glyph}
                initialValues={
                  自定义字根序列 ??
                  字根序列.map((x) => (x instanceof 部件 ? x.字符 : x))
                }
              />
            }
          >
            <Button>自定义</Button>
          </Popover>
        </Flex>
      )}
    </Flex>
  );
}

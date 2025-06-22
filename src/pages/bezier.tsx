import type { BasicComponent, PrimitiveCharacter, SVGStroke } from "~/lib";
import { Flex, Layout, Typography } from "antd";
import { useChaifenTitle } from "~/atoms";
import { Box, StrokesView } from "~/components/GlyphView";
import { dump } from "js-yaml";
import type React from "react";
import { useEffect, useState } from "react";

const TestComponent: React.FC<{
  character: PrimitiveCharacter;
  setCharacter: (c: PrimitiveCharacter) => void;
}> = ({ character, setCharacter }) => {
  const name = String.fromCharCode(character.unicode);
  const basicComponent = character.glyphs[0] as BasicComponent;
  return (
    <Flex key={character.unicode} gap="middle" justify="center" align="center">
      <span style={{ fontSize: "2rem" }}>
        {name} ({character.unicode.toString(16).toUpperCase()})
      </span>
      <Box>
        <StrokesView
          glyph={basicComponent.strokes}
          setGlyph={(g: SVGStroke[]) => {
            setCharacter({
              ...character,
              glyphs: [{ ...basicComponent, strokes: g }],
            });
          }}
        />
      </Box>
      <div
        style={{
          width: "400px",
          padding: "16px",
          backgroundColor: "#DDD",
          borderRadius: "8px",
        }}
      >
        <pre style={{ textWrap: "wrap" }}>
          {dump(basicComponent.strokes, { flowLevel: 3 })}
        </pre>
      </div>
    </Flex>
  );
};

export default function BezierLayout() {
  useChaifenTitle("Bezier 曲线测试");
  const [data, setData] = useState([] as PrimitiveCharacter[]);
  // useEffect(() => {
  //   Promise.all(
  //     [0x4e00, 0x4e01, 0x4e03, 0x4e07, 0x4e08].map(fetchCharacterByUnicode),
  //   ).then(setData);
  // }, []);

  return (
    <Layout style={{ height: "100%", overflowY: "scroll" }}>
      <Typography.Title>Bezier 曲线测试</Typography.Title>
      <Typography.Paragraph>
        本页面用于测试字形的 Bezier
        曲线表示，每个字形（Glyph）由一个或多个笔画（Stroke）组成，每个笔画由一个或多个
        Bezier 曲线（Curve）组成，每个 Bezier 曲线可以是一次（Horizontal,
        Vertical）或者三次（Cubic）。
      </Typography.Paragraph>
      <Typography.Paragraph>
        本页面展示了五个汉字的笔画数据，右边是原始数据，左边是用
        <code>&lt;StrokesView&gt;</code>渲染得到的 SVG 图形，其中使用了 path
        标签来表示路径的数据。
      </Typography.Paragraph>
      <Flex vertical gap="middle">
        {data.map((character, index) => {
          return (
            <TestComponent
              key={index}
              character={character}
              setCharacter={(c: PrimitiveCharacter) =>
                setData(data.map((char, i) => (i === index ? c : char)))
              }
            />
          );
        })}
      </Flex>
    </Layout>
  );
}

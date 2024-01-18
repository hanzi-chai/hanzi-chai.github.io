import { Form, Input } from "antd";
import { Operator, PrimitiveRepertoire, Repertoire, operators } from "~/lib";
import {
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  QueryFilter,
} from "@ant-design/pro-components";
import { useAtomValue } from "jotai";
import { tagsAtom } from "~/atoms";
import { GlyphSelect } from "./CharacterSelect";

interface StrokeSearchProps {
  setFilter: (s: CharacterFilter) => void;
}

export const makeCharacterFilter =
  (
    input: CharacterFilter,
    repertoire: Repertoire | PrimitiveRepertoire,
    sequence: Map<string, string>,
  ) =>
  (char: string) => {
    const character = repertoire[char];
    if (character === undefined) return false;
    const name = character.name ?? "";
    const seq = sequence.get(char) ?? "";
    const isNameMatched = (name + char).includes(input.name ?? "");
    const isSequenceMatched = seq.startsWith(input.sequence ?? "");
    const isUnicodeMatched =
      input.unicode === undefined || input.unicode === char.codePointAt(0);
    const isTagMatched =
      input.tag === undefined ||
      ("glyphs" in character &&
        character.glyphs.some((x) => x.tags?.includes(input.tag!))) ||
      ("glyph" in character && character.glyph?.tags?.includes(input.tag));
    const isOperatorMatched =
      input.operator === undefined ||
      ("glyphs" in character &&
        character.glyphs.some(
          (x) => "operator" in x && x.operator.includes(input.operator!),
        )) ||
      ("glyph" in character &&
        character.glyph?.type === "compound" &&
        character.glyph.operator.includes(input.operator));
    const isPartMatched =
      input.part === undefined ||
      ("glyphs" in character &&
        character.glyphs.some(
          (x) => "operandList" in x && x.operandList.includes(input.part!),
        )) ||
      ("glyph" in character &&
        character.glyph?.type === "compound" &&
        character.glyph.operandList.includes(input.part));
    return (
      isNameMatched &&
      isSequenceMatched &&
      isUnicodeMatched &&
      isTagMatched &&
      isOperatorMatched &&
      isPartMatched
    );
  };

export interface CharacterFilter {
  name?: string;
  sequence?: string;
  unicode?: number;
  tag?: string;
  part?: string;
  operator?: Operator;
}

export default function ({ setFilter }: StrokeSearchProps) {
  const tags = useAtomValue(tagsAtom);
  return (
    <QueryFilter<CharacterFilter>
      onValuesChange={async (_, values) => setFilter(values)}
      labelWidth="auto"
      submitter={false}
      style={{ maxWidth: 1080 }}
    >
      <ProFormDigit label="Unicode" name="unicode" />
      <ProFormText label="名称" name="name" />
      <ProFormText label="笔画" name="sequence" />
      <ProFormSelect
        label="包含标签"
        name="tag"
        options={tags.map((x) => ({ label: x, value: x }))}
      />
      <ProFormSelect
        label="包含结构"
        name="operator"
        options={operators.map((x) => ({ label: x, value: x }))}
      />
      <Form.Item label="包含部分" name="part">
        <GlyphSelect allowClear={true} />
      </Form.Item>
    </QueryFilter>
  );
}

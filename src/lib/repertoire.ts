import {
  ComponentResults,
  ComponentAnalysis,
  disassembleComponents,
  recursiveRenderComponent,
} from "./component";
import { CompoundResults, disassembleCompounds } from "./compound";
import { Config, CustomGlyph } from "./config";
import {
  Compound,
  Character,
  Repertoire,
  PrimitiveRepertoire,
  SVGGlyph,
  Component,
} from "./data";

export const findGlyphIndex = (
  glyphs: (Component | Compound)[],
  tags: string[],
) => {
  for (const tag of tags) {
    const withTag = glyphs.findIndex((x) => (x.tags ?? []).includes(tag));
    if (withTag !== -1) return withTag;
  }
  return 0;
};

/**
 * 将原始字符集转换为字符集
 * 主要的工作是对每个字符，在数据库中的多个字形中选取一个
 *
 * @param repertoire 原始字符集
 * @param customization 自定义字形
 * @param tags 用户选择的标签
 *
 * 基本逻辑为，对于每个字符，
 * - 如果用户指定了字形，则使用用户指定的字形
 * - 如果用户指定的某个标签匹配上了这个字符的某个字形，则使用这个字形
 * - 如果都没有，就使用默认字形
 */
export const determine = (
  repertoire: PrimitiveRepertoire,
  customization: CustomGlyph = {},
  tags: string[] = [],
) => {
  const determined: Repertoire = {};
  const glyphCache: Map<string, SVGGlyph> = new Map();
  for (const [name, character] of Object.entries(repertoire)) {
    const { ambiguous, glyphs, ...rest } = character;
    const selectedIndex = findGlyphIndex(glyphs, tags);
    const rawglyph = customization[name] ?? glyphs[selectedIndex];
    let glyph: Character["glyph"];
    if (rawglyph?.type === "derived_component") {
      const svgglyph = recursiveRenderComponent(
        rawglyph,
        repertoire,
        glyphCache,
      );
      if (svgglyph instanceof Error) {
        continue;
      }
      glyph = {
        type: "basic_component",
        tags: rawglyph.tags,
        strokes: svgglyph,
      };
    } else {
      glyph = rawglyph;
    }
    const determined_character: Character = { ...rest, glyph };
    determined[name] = determined_character;
  }
  return determined;
};

export interface AnalysisResult {
  componentResults: ComponentResults;
  componentError: string[];
  customizations: ComponentResults;
  customized: ComponentResults;
  compoundResults: CompoundResults;
  compoundError: string[];
}

/**
 * 对整个字符集中的字符进行拆分
 *
 * @param repertoire 字符集
 * @param config 配置
 */
export const analysis = function (
  repertoire: Repertoire,
  config: Config,
): AnalysisResult {
  const [componentResults, componentError] = disassembleComponents(
    repertoire,
    config,
  );
  const customizations: ComponentResults = new Map(
    Object.entries(config.analysis?.customize ?? {}).map(
      ([component, sequence]) => {
        const pseudoResult: ComponentAnalysis = {
          strokes: 0,
          sequence: sequence,
        };
        return [component, pseudoResult] as const;
      },
    ),
  );
  const customized = new Map([...componentResults, ...customizations]);
  const [compoundResults, compoundError] = disassembleCompounds(
    repertoire,
    config,
    customized,
  );
  return {
    componentResults,
    componentError,
    customizations,
    customized,
    compoundResults,
    compoundError,
  };
};

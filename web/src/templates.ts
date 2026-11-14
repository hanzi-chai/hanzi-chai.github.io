import { 创建方案模板, type Example, type 示例配置 } from "hanzi-chai";
export type {
  Example,
  ClassifierType,
  KeyboardTypes,
  EncoderTypes,
  StarterType,
} from "hanzi-chai";

const modules = import.meta.glob("../../examples/*.yaml", {
  eager: true,
  import: "default",
}) as Record<string, 示例配置>;

export const examples = Object.fromEntries(
  Object.entries(modules).map(([path, config]) => [
    path.slice(path.lastIndexOf("/") + 1, -5),
    config,
  ]),
) as Record<Example, 示例配置>;

export const {
  classifierTypes,
  keyboardTypes,
  encoderTypes,
  createConfig,
  defaultConfig,
} = 创建方案模板(examples);

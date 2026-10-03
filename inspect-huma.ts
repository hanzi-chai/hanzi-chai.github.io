import { readFileSync } from "fs";
import yaml from "js-yaml";
const ROOT = "D:/chai魔改";
const d: any = yaml.load(readFileSync(ROOT + "/chaifen-docs/examples/huma.yaml", "utf8"));
const enc = d.encoder, form = d.form;
console.log("info:", JSON.stringify(d.info));
console.log("selector:", JSON.stringify(d.analysis.selector));
console.log("degenerator:", JSON.stringify(d.analysis.degenerator));
console.log("customize字数:", Object.keys(d.analysis.customize ?? {}).length);
console.log("alphabet:", form.alphabet, "mapping_type:", form.mapping_type);
console.log("mapping条目:", Object.keys(form.mapping).length,
  "space:", form.mapping_space ? Object.keys(form.mapping_space).length : 0,
  "vars:", form.mapping_variables ? Object.keys(form.mapping_variables).length : 0,
  "gens:", (form.mapping_generators ?? []).length);
for (const k of ["max_length","select_keys","auto_select_length","auto_select_pattern","short_code","short_code_list","rules","assembler"])
  console.log(k, "=", JSON.stringify(enc[k]));
console.log("sources:", Object.keys(enc.sources ?? {}).length, "conditions:", Object.keys(enc.conditions ?? {}).length);
console.log("data keys:", Object.keys(d.data ?? {}));
console.log("character_set:", d.data?.character_set, "repertoire:", Object.keys(d.data?.repertoire ?? {}).length);
console.log("mapping样例:", JSON.stringify(Object.entries(form.mapping).slice(0, 8)));

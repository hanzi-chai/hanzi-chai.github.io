import { atom } from "jotai";
import { AssemblyResult } from "~/lib/assembly";
import { AnalysisResult } from "~/lib/repertoire";

export const analysisResultAtom = atom<AnalysisResult | null>(null);

export const assemblyResultAtom = atom<AssemblyResult | null>(null);

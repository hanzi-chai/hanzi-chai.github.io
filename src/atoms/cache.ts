import { atom } from "jotai";
import { AssemblyResult } from "~/lib";
import { AnalysisResult } from "~/lib";

export const analysisResultAtom = atom<AnalysisResult | null>(null);

export const assemblyResultAtom = atom<AssemblyResult | null>(null);

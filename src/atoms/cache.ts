import { atom } from "jotai";
import { AssemblyResult } from "~/lib";
import { AnalysisResult } from "~/lib";
import { EncodeResult } from ".";

export const analysisResultAtom = atom<AnalysisResult | null>(null);

export const assemblyResultAtom = atom<AssemblyResult | null>(null);

export const encodeResultAtom = atom<EncodeResult | null>(null);

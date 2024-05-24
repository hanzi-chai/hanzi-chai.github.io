import { atom } from "jotai";
import { EncodeResult } from "~/components/Utils";
import { AssemblyResult } from "~/lib";
import { AnalysisResult } from "~/lib";

export const analysisResultAtom = atom<AnalysisResult | null>(null);

export const assemblyResultAtom = atom<AssemblyResult | null>(null);

export const encodeResultAtom = atom<EncodeResult | null>(null);

import { focusAtom } from "jotai-optics";
import { optimAtom } from ".";

export const objectiveAtom = focusAtom(optimAtom, (o) => o.prop("objective"));
objectiveAtom.debugLabel = "optimization.objective";

export const metaheuristicAtom = focusAtom(optimAtom, (o) =>
  o.prop("metaheuristic"),
);
metaheuristicAtom.debugLabel = "optimization.metaheuristic";

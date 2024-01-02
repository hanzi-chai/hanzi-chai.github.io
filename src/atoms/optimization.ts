import { focusAtom } from "jotai-optics";
import { atom, optimAtom } from ".";

export const objectiveAtom = focusAtom(optimAtom, (o) => o.prop("objective"));
objectiveAtom.debugLabel = "optimization.objective";

export const metaheuristicAtom = focusAtom(optimAtom, (o) =>
  o.prop("metaheuristic"),
);
metaheuristicAtom.debugLabel = "optimization.metaheuristic";

export const constraintsAtom = focusAtom(optimAtom, (o) =>
  o.prop("constraints"),
);
constraintsAtom.debugLabel = "optimization.constraints";

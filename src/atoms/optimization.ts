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

export const parametersAtom = focusAtom(metaheuristicAtom, (o) =>
  o.prop("parameters"),
);

export const searchMethodAtom = focusAtom(metaheuristicAtom, (o) =>
  o.prop("search_method").valueOr({ random_move: 0.9, random_swap: 0.1 }),
);
searchMethodAtom.debugLabel = "optimization.search_method";
